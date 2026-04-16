import { SenderType } from '@prisma/client';
import prisma from '../lib/prisma';
import { getSocketIO } from '../lib/socket';
import { logger } from '../lib/logger';

export class AiBotService {
  static async reply(conversationId: string, customerMessage: string): Promise<void> {
    try {
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
