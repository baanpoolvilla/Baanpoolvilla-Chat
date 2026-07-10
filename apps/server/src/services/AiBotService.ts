import { SenderType, Platform } from '@prisma/client';
import axios from 'axios';
import prisma from '../lib/prisma';
import { getSocketIO } from '../lib/socket';
import { logger } from '../lib/logger';
import { conversationSummarySelect } from './ConversationService';

export class AiBotService {
  // ─── Save bot reply to DB, emit Socket.IO, send to platform ─────────────
  static async deliverBotReply(conversationId: string, replyText: string): Promise<void> {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { contact: true },
    });

    if (!conversation) {
      logger.error('Conversation not found for bot reply delivery', { conversationId });
      return;
    }

    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId,
          senderType: SenderType.BOT,
          content: replyText,
          contentType: 'TEXT',
        },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessage: replyText.substring(0, 200),
          lastMsgAt: new Date(),
        },
      });
      return msg;
    });

    const fullMessage = await prisma.message.findUnique({
      where: { id: message.id },
      include: { conversation: { include: { contact: true } } },
    });

    const io = getSocketIO();
    io.to(`conversation:${conversationId}`).emit('message:new', fullMessage);

    const updatedConversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: conversationSummarySelect,
    });
    if (updatedConversation) {
      io.emit('conversation:updated', updatedConversation);
    }

    const platformContact = await prisma.platformContact.findFirst({
      where: { contactId: conversation.contactId, platform: conversation.platform },
    });

    if (platformContact) {
      try {
        const { LineService } = await import('./platforms/LineService');
        const { FacebookService } = await import('./platforms/FacebookService');
        const { InstagramService } = await import('./platforms/InstagramService');
        const { TikTokService } = await import('./platforms/TikTokService');

        switch (conversation.platform) {
          case 'LINE':
            await LineService.sendMessage(conversation.channelId, replyText, 'TEXT');
            break;
          case 'FACEBOOK':
            await FacebookService.sendMessage(platformContact.platformUid, replyText, 'TEXT');
            break;
          case 'INSTAGRAM':
            await InstagramService.sendMessage(platformContact.platformUid, replyText, 'TEXT');
            break;
          case 'TIKTOK':
            await TikTokService.sendMessage(platformContact.platformUid, replyText, 'TEXT');
            break;
        }
      } catch (sendError) {
        logger.error('Failed to send bot reply to platform', {
          error: sendError,
          conversationId,
          platform: conversation.platform,
        });
      }
    }

    logger.info('Bot reply delivered', { conversationId, platform: conversation.platform });
  }

  static async reply(conversationId: string, customerMessage: string, contactName?: string, platform?: Platform): Promise<void> {
    try {
      // ─── ถ้ามี N8N_WEBHOOK_URL → ส่งไป n8n แทน (fire-and-forget) ──────────
      const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
      logger.info('AiBotService.reply called', { conversationId, n8nWebhookUrl: n8nWebhookUrl ? 'SET' : 'NOT SET' });
      if (n8nWebhookUrl) {
        await AiBotService.forwardToN8n(n8nWebhookUrl, conversationId, customerMessage, contactName, platform);
        return;
      }

      // ─── Fallback: ใช้ AI โดยตรง (OpenAI / Anthropic) ────────────────────
      const config = await prisma.aiBotConfig.findFirst({
        where: { isActive: true },
      });

      if (!config) {
        logger.debug('No active AI bot config, skipping auto-reply');
        return;
      }

      const io = getSocketIO();
      io.to(`conversation:${conversationId}`).emit('bot:typing', { conversationId });

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          contact: true,
          messages: {
            orderBy: { sentAt: 'desc' },
            take: 20,
          },
        },
      });

      if (!conversation) {
        logger.error('Conversation not found for AI reply', { conversationId });
        return;
      }

      const messages = conversation.messages.reverse().map((m) => ({
        role: m.senderType === SenderType.CUSTOMER ? 'user' as const : 'assistant' as const,
        content: m.content,
      }));

      messages.push({ role: 'user', content: customerMessage });

      let botReply: string;

      if (config.provider === 'openai') {
        botReply = await AiBotService.callOpenAI(config, messages);
      } else if (config.provider === 'anthropic') {
        botReply = await AiBotService.callAnthropic(config, messages);
      } else {
        logger.error('Unknown AI provider', { provider: config.provider });
        return;
      }

      if (customerMessage.includes('คุยกับเจ้าหน้าที่') || customerMessage.includes('talk to agent')) {
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { isBot: false },
        });

        botReply = 'กำลังเชื่อมต่อกับเจ้าหน้าที่ กรุณารอสักครู่ค่ะ / Connecting you to an agent, please wait.';

        io.emit('conversation:updated', {
          id: conversationId,
          isBot: false,
        });

        logger.info('Bot handoff triggered', { conversationId });
      }

      const message = await prisma.$transaction(async (tx) => {
        const msg = await tx.message.create({
          data: {
            conversationId,
            senderType: SenderType.BOT,
            content: botReply,
            contentType: 'TEXT',
          },
        });

        await tx.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessage: botReply.substring(0, 200),
            lastMsgAt: new Date(),
          },
        });

        return msg;
      });

      const fullMessage = await prisma.message.findUnique({
        where: { id: message.id },
        include: { conversation: { include: { contact: true } } },
      });

      io.to(`conversation:${conversationId}`).emit('message:new', fullMessage);

      const platformContact = await prisma.platformContact.findFirst({
        where: {
          contactId: conversation.contactId,
          platform: conversation.platform,
        },
      });

      if (platformContact) {
        try {
          const { LineService } = await import('./platforms/LineService');
          const { FacebookService } = await import('./platforms/FacebookService');
          const { InstagramService } = await import('./platforms/InstagramService');
          const { TikTokService } = await import('./platforms/TikTokService');

          switch (conversation.platform) {
            case 'LINE':
              await LineService.sendMessage(platformContact.platformUid, botReply, 'TEXT');
              break;
            case 'FACEBOOK':
              await FacebookService.sendMessage(platformContact.platformUid, botReply, 'TEXT');
              break;
            case 'INSTAGRAM':
              await InstagramService.sendMessage(platformContact.platformUid, botReply, 'TEXT');
              break;
            case 'TIKTOK':
              await TikTokService.sendMessage(platformContact.platformUid, botReply, 'TEXT');
              break;
          }
        } catch (sendError) {
          logger.error('Failed to send bot reply to platform', {
            error: sendError,
            conversationId,
            platform: conversation.platform,
          });
        }
      }

      logger.info('AI bot replied', { conversationId, provider: config.provider });
    } catch (error) {
      logger.error('AiBotService.reply failed', { error, conversationId });
    }
  }

  // ─── Forward to n8n webhook ───────────────────────────────────────────────
  private static async forwardToN8n(
    webhookUrl: string,
    conversationId: string,
    customerMessage: string,
    contactName?: string,
    platform?: Platform,
  ): Promise<void> {
    try {
      // ดึง history 20 ข้อความล่าสุดเพื่อส่งให้ n8n
      const recentMessages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { sentAt: 'desc' },
        take: 20,
        select: { senderType: true, content: true, sentAt: true },
      });

      const history = recentMessages.reverse().map((m) => ({
        role: m.senderType === SenderType.CUSTOMER ? 'user' : 'assistant',
        content: m.content,
        sentAt: m.sentAt,
      }));

      const now = new Date();
      const payload = {
        conversationId,
        message: customerMessage,
        contactName: contactName ?? 'Customer',
        platform: platform ?? 'LINE',
        history,
        currentDate: now.toISOString().split('T')[0],
        currentDatetime: now.toISOString(),
        currentDayOfWeek: now.toLocaleDateString('th-TH', { weekday: 'long', timeZone: 'Asia/Bangkok' }),
        timezone: 'Asia/Bangkok',
      };

      const response = await axios.post(webhookUrl, payload, {
        timeout: 10_000,
        headers: { 'Content-Type': 'application/json' },
      });

      logger.info('Forwarded to n8n webhook', { conversationId, status: response.status });
    } catch (error) {
      logger.error('Failed to forward to n8n webhook', { error, conversationId });
    }
  }

  private static async callOpenAI(
    config: { model: string; apiKey: string; systemPrompt: string },
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: config.apiKey });

    const response = await client.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: config.systemPrompt },
        ...messages,
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || 'ขออภัย ไม่สามารถตอบได้ในขณะนี้';
  }

  private static async callAnthropic(
    config: { model: string; apiKey: string; systemPrompt: string },
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: config.apiKey });

    const response = await client.messages.create({
      model: config.model,
      max_tokens: 1000,
      system: config.systemPrompt,
      messages,
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock ? textBlock.text : 'ขออภัย ไม่สามารถตอบได้ในขณะนี้';
  }
}
