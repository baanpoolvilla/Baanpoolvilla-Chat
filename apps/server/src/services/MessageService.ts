import { Platform, SenderType, ContentType, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { getSocketIO } from '../lib/socket';
import { logger } from '../lib/logger';
import { AiBotService } from './AiBotService';
import { conversationSummarySelect } from './ConversationService';

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
          // Only sync avatarUrl when the platform provides a new one.
          if (incoming.avatarUrl && incoming.avatarUrl !== contact.avatarUrl) {
            contact = await tx.contact.update({
              where: { id: contact.id },
              data: { avatarUrl: incoming.avatarUrl },
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

        const message = await tx.message.create({
          data: {
            conversationId: conversation.id,
            senderType: SenderType.CUSTOMER,
            content: incoming.content,
            contentType: incoming.contentType,
            mediaUrl: incoming.mediaUrl,
            metadata: incoming.metadata as Prisma.InputJsonValue | undefined,
            platformMsgId: incoming.platformMsgId,
          },
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
  }): Promise<unknown> {
    try {
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

      const message = await prisma.$transaction(async (tx) => {
        const msg = await tx.message.create({
          data: {
            conversationId: params.conversationId,
            senderType: SenderType.ADMIN,
            adminId: params.adminId,
            content: params.content,
            contentType: params.contentType,
            mediaUrl: params.mediaUrl,
          },
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

      const fullMessage = await prisma.message.findUnique({
        where: { id: message.id },
        select: {
          id: true,
          conversationId: true,
          senderType: true,
          adminId: true,
          content: true,
          contentType: true,
          mediaUrl: true,
          metadata: true,
          platformMsgId: true,
          isRead: true,
          sentAt: true,
          admin: { select: { id: true, name: true, avatar: true } },
        },
      });

      const io = getSocketIO();
      io.to(`conversation:${params.conversationId}`).emit('message:new', fullMessage);

      const platformContact = conversation.contact.platformLinks.find(
        (pl) => pl.platform === conversation.platform
      );

      if (platformContact) {
        const { LineService } = await import('./platforms/LineService');
        const { FacebookService } = await import('./platforms/FacebookService');
        const { InstagramService } = await import('./platforms/InstagramService');
        const { TikTokService } = await import('./platforms/TikTokService');

        switch (conversation.platform) {
          case 'LINE':
            await LineService.sendMessage(platformContact.platformUid, params.content, params.contentType, params.mediaUrl);
            break;
          case 'FACEBOOK':
            await FacebookService.sendMessage(platformContact.platformUid, params.content, params.contentType, params.mediaUrl);
            break;
          case 'INSTAGRAM':
            await InstagramService.sendMessage(platformContact.platformUid, params.content, params.contentType, params.mediaUrl);
            break;
          case 'TIKTOK':
            await TikTokService.sendMessage(platformContact.platformUid, params.content, params.contentType, params.mediaUrl);
            break;
        }
      }

      logger.info('Admin message sent', {
        conversationId: params.conversationId,
        adminId: params.adminId,
      });

      return fullMessage;
    } catch (error) {
      logger.error('MessageService.sendAdminMessage failed', { error, params });
      throw error;
    }
  }
}
