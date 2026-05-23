import { Platform, SenderType, ContentType, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { getSocketIO } from '../lib/socket';
import { logger } from '../lib/logger';
import { AiBotService } from './AiBotService';
import { conversationSummarySelect } from './ConversationService';

export const messageReplyPreviewSelect = {
  id: true,
  conversationId: true,
  senderType: true,
  adminId: true,
  content: true,
  contentType: true,
  mediaUrl: true,
  sentAt: true,
  admin: { select: { id: true, name: true, avatar: true } },
} as const;

export const messageWithReplySelect = {
  id: true,
  conversationId: true,
  senderType: true,
  adminId: true,
  replyToMessageId: true,
  content: true,
  contentType: true,
  mediaUrl: true,
  metadata: true,
  platformMsgId: true,
  isRead: true,
  isPinned: true,
  pinnedAt: true,
  sentAt: true,
  admin: { select: { id: true, name: true, avatar: true } },
  replyToMessage: { select: messageReplyPreviewSelect },
} as const;

export interface IncomingMessage {
  platform: Platform;
  platformUid: string;
  platformMsgId?: string;
  channelId: string;
  displayName: string;
  avatarUrl?: string;
  content: string;
  contentType: ContentType;
  mediaUrl?: string;
  metadata?: Record<string, unknown>;
}

function getReplySenderLabel(replyMessage: {
  senderType: SenderType;
  admin?: { name: string | null } | null;
}): string {
  switch (replyMessage.senderType) {
    case SenderType.CUSTOMER:
      return 'Customer';
    case SenderType.BOT:
      return 'AI Bot';
    case SenderType.SYSTEM:
      return 'System';
    default:
      return replyMessage.admin?.name || 'Admin';
  }
}

function getReplyPreviewText(replyMessage: {
  content: string;
  contentType: ContentType;
}): string {
  switch (replyMessage.contentType) {
    case ContentType.IMAGE:
      return replyMessage.content && replyMessage.content !== '[Image]' ? replyMessage.content : 'Photo';
    case ContentType.VIDEO:
      return replyMessage.content && replyMessage.content !== '[Video]' ? replyMessage.content : 'Video';
    case ContentType.AUDIO:
      return replyMessage.content || 'Audio';
    case ContentType.FILE:
      return replyMessage.content || 'File';
    case ContentType.STICKER:
      return 'Sticker';
    case ContentType.LOCATION:
      return 'Location';
    case ContentType.TEMPLATE:
      return replyMessage.content || 'Template';
    default:
      return replyMessage.content;
  }
}

function formatQuotedOutboundText(content: string, replyMessage?: {
  senderType: SenderType;
  admin?: { name: string | null } | null;
  content: string;
  contentType: ContentType;
} | null): string {
  if (!replyMessage) {
    return content;
  }

  const senderLabel = getReplySenderLabel(replyMessage);
  const preview = getReplyPreviewText(replyMessage)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(' / ')
    .slice(0, 120);

  const quoteHeader = `Reply to ${senderLabel}`;
  const quoteBody = preview ? `> ${preview}` : '> Message';
  return `${quoteHeader}\n${quoteBody}\n\n${content}`;
}

export class MessageService {
  static async ingest(incoming: IncomingMessage): Promise<void> {
    try {
      if (incoming.platformMsgId) {
        const existing = await prisma.message.findFirst({
          where: { platformMsgId: incoming.platformMsgId },
        });
        if (existing) {
          logger.debug('Duplicate message ignored', { platformMsgId: incoming.platformMsgId });
          return;
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        let platformContact = await tx.platformContact.findUnique({
          where: {
            platform_platformUid: {
              platform: incoming.platform,
              platformUid: incoming.platformUid,
            },
          },
          include: { contact: true },
        });

        let contact;
        if (!platformContact) {
          contact = await tx.contact.create({
            data: {
              displayName: incoming.displayName,
              originalDisplayName: incoming.displayName,
              avatarUrl: incoming.avatarUrl,
              platformLinks: {
                create: {
                  platform: incoming.platform,
                  platformUid: incoming.platformUid,
                },
              },
            },
          });
        } else {
          contact = platformContact.contact;
          // Never overwrite displayName from webhook — admin renames must be preserved.
          // Only sync avatarUrl and backfill originalDisplayName when needed.
          const contactUpdateData: Record<string, unknown> = {};
          if (incoming.avatarUrl && incoming.avatarUrl !== contact.avatarUrl) {
            contactUpdateData.avatarUrl = incoming.avatarUrl;
          }
          // Backfill originalDisplayName using the real LINE profile name from webhook
          // (only set once; never overwritten so it always reflects the first known LINE name)
          if (!contact.originalDisplayName) {
            contactUpdateData.originalDisplayName = incoming.displayName;
            // If the stored displayName differs from LINE's real name, the admin has customized it
            if (incoming.displayName !== contact.displayName) {
              contactUpdateData.isNameCustomized = true;
            }
          }
          if (Object.keys(contactUpdateData).length > 0) {
            contact = await tx.contact.update({
              where: { id: contact.id },
              data: contactUpdateData,
            });
          }
        }

        let conversation = await tx.conversation.findFirst({
          where: {
            contactId: contact.id,
            platform: incoming.platform,
            channelId: incoming.channelId,
            status: { in: ['OPEN', 'PENDING'] },
          },
        });

        if (!conversation) {
          conversation = await tx.conversation.create({
            data: {
              contactId: contact.id,
              platform: incoming.platform,
              channelId: incoming.channelId,
              status: 'OPEN',
              isBot: true,
              lastMessage: incoming.content.substring(0, 200),
              lastMsgAt: new Date(),
              unreadCount: 1,
            },
          });
        } else {
          conversation = await tx.conversation.update({
            where: { id: conversation.id },
            data: {
              lastMessage: incoming.content.substring(0, 200),
              lastMsgAt: new Date(),
              unreadCount: { increment: 1 },
              status: conversation.status === 'RESOLVED' ? 'OPEN' : conversation.status,
            },
          });
        }

        // Resolve replyToMessageId from quotedMessageId in metadata (e.g. LINE native reply)
        let replyToMessageId: string | undefined;
        const quotedPlatformMsgId = incoming.metadata?.quotedMessageId as string | null | undefined;
        if (quotedPlatformMsgId) {
          const quoted = await tx.message.findFirst({
            where: { platformMsgId: quotedPlatformMsgId },
            select: { id: true },
          });
          if (quoted) replyToMessageId = quoted.id;
        }

        const message = await tx.message.create({
          data: {
            conversationId: conversation.id,
            senderType: SenderType.CUSTOMER,
            content: incoming.content,
            contentType: incoming.contentType,
            mediaUrl: incoming.mediaUrl,
            metadata: incoming.metadata as Prisma.InputJsonValue | undefined,
            platformMsgId: incoming.platformMsgId,
            ...(replyToMessageId && { replyToMessageId }),
          },
          select: messageWithReplySelect,
        });

        return { contact, conversation, message };
      });

      const io = getSocketIO();

      io.to(`conversation:${result.conversation.id}`).emit('message:new', result.message);

      const fullConversation = await prisma.conversation.findUnique({
        where: { id: result.conversation.id },
        select: conversationSummarySelect,
      });
      if (fullConversation) {
        io.emit('conversation:updated', fullConversation);
      }

      if (result.conversation.isBot) {
        AiBotService.reply(result.conversation.id, incoming.content).catch((err) => {
          logger.error('AI bot reply failed', { error: err.message, conversationId: result.conversation.id });
        });
      } else {
        io.emit('admin:notify', {
          conversationId: result.conversation.id,
          contactName: result.contact.displayName,
          message: incoming.content.substring(0, 100),
          platform: incoming.platform,
        });
      }

      logger.info('Message ingested', {
        conversationId: result.conversation.id,
        platform: incoming.platform,
        senderType: 'CUSTOMER',
      });
    } catch (error) {
      logger.error('MessageService.ingest failed', { error, incoming });
      throw error;
    }
  }

  static async sendAdminMessage(params: {
    conversationId: string;
    adminId: string;
    content: string;
    contentType: ContentType;
    mediaUrl?: string;
    replyToMessageId?: string;
    clientRequestId?: string;
  }): Promise<unknown> {
    try {
      // Idempotency: if clientRequestId was already processed, return existing message
      if (params.clientRequestId) {
        const existing = await prisma.message.findFirst({
          where: {
            conversationId: params.conversationId,
            adminId: params.adminId,
            metadata: { path: ['clientRequestId'], equals: params.clientRequestId },
          },
          select: messageWithReplySelect,
        });
        if (existing) {
          logger.info('Idempotent message: returning existing', { clientRequestId: params.clientRequestId });
          return existing;
        }
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id: params.conversationId },
        include: {
          contact: {
            include: { platformLinks: true },
          },
        },
      });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      let replyTargetQuoteToken: string | undefined;
      const message = await prisma.$transaction(async (tx) => {
        if (params.replyToMessageId) {
          const replyTarget = await tx.message.findFirst({
            where: {
              id: params.replyToMessageId,
              conversationId: params.conversationId,
            },
            select: { id: true, metadata: true },
          });

          if (!replyTarget) {
            throw new Error('Reply target not found');
          }
          replyTargetQuoteToken = (replyTarget.metadata as Record<string, unknown>)?.quoteToken as string | undefined;
        }

        const msg = await tx.message.create({
          data: {
            conversationId: params.conversationId,
            senderType: SenderType.ADMIN,
            adminId: params.adminId,
            replyToMessageId: params.replyToMessageId,
            content: params.content,
            contentType: params.contentType,
            mediaUrl: params.mediaUrl,
            metadata: params.clientRequestId ? { clientRequestId: params.clientRequestId } : undefined,
          },
          select: messageWithReplySelect,
        });

        await tx.conversation.update({
          where: { id: params.conversationId },
          data: {
            lastMessage: params.content.substring(0, 200),
            lastMsgAt: new Date(),
          },
        });

        return msg;
      });

      const io = getSocketIO();
      io.to(`conversation:${params.conversationId}`).emit('message:new', message);

      const platformContact = conversation.contact.platformLinks.find(
        (pl) => pl.platform === conversation.platform
      );

      if (platformContact) {
        const { LineService } = await import('./platforms/LineService');
        const { FacebookService } = await import('./platforms/FacebookService');
        const { InstagramService } = await import('./platforms/InstagramService');
        const { TikTokService } = await import('./platforms/TikTokService');
        const transportText = formatQuotedOutboundText(params.content, message.replyToMessage);

        switch (conversation.platform) {
          case 'LINE': {
            // Use native LINE Quote Reply when the target message has a quoteToken
            // (only Text and Sticker support native quoteToken per LINE Messaging API)
            const canNativeQuote = Boolean(replyTargetQuoteToken) &&
              (params.contentType === ContentType.TEXT || params.contentType === ContentType.STICKER);
            const lineContent = canNativeQuote ? params.content : transportText;
            const lineQuoteToken = canNativeQuote ? replyTargetQuoteToken : undefined;

            const lineResult = await LineService.sendMessage(
              platformContact.platformUid,
              lineContent,
              params.contentType,
              params.mediaUrl,
              lineQuoteToken,
            );

            // Save the quoteToken from LINE's response so this message can be natively quoted later
            if (lineResult.quoteToken) {
              const existingMeta = (message.metadata as Record<string, unknown>) ?? {};
              await prisma.message.update({
                where: { id: message.id },
                data: { metadata: { ...existingMeta, quoteToken: lineResult.quoteToken } },
              });
            }
            break;
          }
          case 'FACEBOOK':
            await FacebookService.sendMessage(platformContact.platformUid, transportText, params.contentType, params.mediaUrl);
            break;
          case 'INSTAGRAM':
            await InstagramService.sendMessage(platformContact.platformUid, transportText, params.contentType, params.mediaUrl);
            break;
          case 'TIKTOK':
            await TikTokService.sendMessage(platformContact.platformUid, transportText, params.contentType, params.mediaUrl);
            break;
        }
      }

      logger.info('Admin message sent', {
        conversationId: params.conversationId,
        adminId: params.adminId,
      });

      return message;
    } catch (error) {
      logger.error('MessageService.sendAdminMessage failed', { error, params });
      throw error;
    }
  }

  static async togglePin(messageId: string, isPinned: boolean) {
    const message = await prisma.message.update({
      where: { id: messageId },
      data: {
        isPinned,
        pinnedAt: isPinned ? new Date() : null,
      },
      select: messageWithReplySelect,
    });

    const io = getSocketIO();
    io.to(`conversation:${message.conversationId}`).emit('message:updated', message);

    return message;
  }
}
