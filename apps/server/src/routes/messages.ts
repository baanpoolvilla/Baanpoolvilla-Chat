import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SenderType } from '@prisma/client';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireChatWriteAccess } from '../middleware/auth';
import { logger } from '../lib/logger';
import { messageWithReplySelect } from '../services/MessageService';
import { getSocketIO } from '../lib/socket';
import { conversationSummarySelect } from '../services/ConversationService';

const router = Router();

// ─── Bot Reply Endpoint (no JWT — uses BOT_REPLY_SECRET header) ──────────────
// ใช้โดย n8n หรือ external bot ส่งคำตอบกลับมา
const botReplySchema = z.object({
  conversationId: z.string().cuid(),
  content: z.string().min(1),
  contentType: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'STICKER', 'LOCATION', 'TEMPLATE']).default('TEXT'),
  mediaUrl: z.string().url().optional(),
});

router.post('/bot', async (req: Request, res: Response): Promise<void> => {
  try {
    const secret = process.env.BOT_REPLY_SECRET;
    if (!secret || req.headers['x-bot-secret'] !== secret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const data = botReplySchema.parse(req.body);

    const conversation = await prisma.conversation.findUnique({
      where: { id: data.conversationId },
      include: { contact: { include: { platformLinks: true } } },
    });

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // ถ้า conversation อยู่ใน Admin mode → ปฏิเสธ ไม่ส่งให้ลูกค้า
    if (!conversation.isBot) {
      res.status(403).json({ error: 'Conversation is in Admin mode. Switch to Bot mode to allow bot replies.' });
      return;
    }

    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId: data.conversationId,
          senderType: SenderType.BOT,
          content: data.content,
          contentType: data.contentType,
          mediaUrl: data.mediaUrl,
        },
        select: messageWithReplySelect,
      });

      await tx.conversation.update({
        where: { id: data.conversationId },
        data: {
          lastMessage: data.content.substring(0, 200),
          lastMsgAt: new Date(),
        },
      });

      return msg;
    });

    const io = getSocketIO();
    io.to(`conversation:${data.conversationId}`).emit('message:new', message);

    const fullConversation = await prisma.conversation.findUnique({
      where: { id: data.conversationId },
      select: conversationSummarySelect,
    });
    if (fullConversation) {
      io.emit('conversation:updated', fullConversation);
    }

    // ส่งไปยัง platform (LINE / Facebook / etc.)
    const platformContact = conversation.contact.platformLinks.find(
      (pl) => pl.platform === conversation.platform,
    );

    if (platformContact) {
      try {
        const { LineService } = await import('../services/platforms/LineService');
        const { FacebookService } = await import('../services/platforms/FacebookService');
        const { InstagramService } = await import('../services/platforms/InstagramService');
        const { TikTokService } = await import('../services/platforms/TikTokService');

        switch (conversation.platform) {
          case 'LINE':
            await LineService.sendMessage(platformContact.platformUid, data.content, data.contentType);
            break;
          case 'FACEBOOK':
            await FacebookService.sendMessage(platformContact.platformUid, data.content, data.contentType, data.mediaUrl);
            break;
          case 'INSTAGRAM':
            await InstagramService.sendMessage(platformContact.platformUid, data.content, data.contentType, data.mediaUrl);
            break;
          case 'TIKTOK':
            await TikTokService.sendMessage(platformContact.platformUid, data.content, data.contentType, data.mediaUrl);
            break;
        }
      } catch (sendError) {
        logger.error('Bot reply: failed to send to platform', { error: sendError, conversationId: data.conversationId });
      }
    }

    logger.info('Bot reply saved', { conversationId: data.conversationId });
    res.json(message);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Bot reply error', { error });
    res.status(500).json({ error: 'Failed to save bot reply' });
  }
});

// ─── All routes below require JWT auth ───────────────────────────────────────
router.use(authMiddleware());

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

    const where: Record<string, unknown> = {};
    if (conversationId) where.conversationId = conversationId;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        select: messageWithReplySelect,
        orderBy: { sentAt: 'desc' },
        skip,
        take: parseInt(limit as string, 10),
      }),
      prisma.message.count({ where }),
    ]);

    res.json({
      messages: messages.reverse(),
      pagination: {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string, 10)),
      },
    });
  } catch (error) {
    logger.error('List messages error', { error });
    res.status(500).json({ error: 'Failed to list messages' });
  }
});

const sendSchema = z.object({
  conversationId: z.string().cuid(),
  content: z.string().min(1),
  contentType: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'STICKER', 'LOCATION', 'TEMPLATE']).default('TEXT'),
  mediaUrl: z.string().url().optional(),
  replyToMessageId: z.string().cuid().optional(),
  clientRequestId: z.string().min(1).max(100).optional(),
});

router.post('/', requireChatWriteAccess, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = sendSchema.parse(req.body);
    const { MessageService } = await import('../services/MessageService');

    const sentMessage = await MessageService.sendAdminMessage({
      conversationId: data.conversationId,
      adminId: req.admin!.id,
      content: data.content,
      contentType: data.contentType,
      mediaUrl: data.mediaUrl,
      replyToMessageId: data.replyToMessageId,
      clientRequestId: data.clientRequestId,
    });

    res.json(sentMessage);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    if (error instanceof Error && error.message === 'Reply target not found') {
      res.status(400).json({ error: 'Reply target not found' });
      return;
    }
    logger.error('Send message error', { error });
    res.status(500).json({ error: 'Failed to send message' });
  }
});

const bulkSendSchema = z.object({
  conversationIds: z.array(z.string().cuid()).min(1).max(50),
  content: z.string().min(1),
  contentType: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'STICKER', 'LOCATION', 'TEMPLATE']).default('TEXT'),
  mediaUrl: z.string().url().optional(),
});

router.post('/bulk-send', requireChatWriteAccess, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = bulkSendSchema.parse(req.body);
    const { MessageService } = await import('../services/MessageService');

    const settled = await Promise.allSettled(
      data.conversationIds.map((conversationId) =>
        MessageService.sendAdminMessage({
          conversationId,
          adminId: req.admin!.id,
          content: data.content,
          contentType: data.contentType,
          mediaUrl: data.mediaUrl,
        })
      )
    );

    const results = settled.map((r, i) => ({
      conversationId: data.conversationIds[i],
      success: r.status === 'fulfilled',
      ...(r.status === 'rejected' && { error: String(r.reason?.message ?? r.reason) }),
    }));

    res.json({ results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Bulk send error', { error });
    res.status(500).json({ error: 'Failed to bulk send messages' });
  }
});

router.get('/pinned', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.query;
    if (!conversationId) {
      res.status(400).json({ error: 'conversationId required' });
      return;
    }
    const messages = await prisma.message.findMany({
      where: { conversationId: conversationId as string, isPinned: true },
      select: messageWithReplySelect,
      orderBy: { pinnedAt: 'desc' },
    });
    res.json({ messages });
  } catch (error) {
    logger.error('Get pinned messages error', { error });
    res.status(500).json({ error: 'Failed to get pinned messages' });
  }
});

const pinSchema = z.object({ isPinned: z.boolean() });

router.patch('/:id/pin', requireChatWriteAccess, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = pinSchema.parse(req.body);
    const { MessageService } = await import('../services/MessageService');
    const message = await MessageService.togglePin(req.params.id, data.isPinned);
    res.json(message);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Pin message error', { error });
    res.status(500).json({ error: 'Failed to pin message' });
  }
});

export default router;
