import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest, requireChatWriteAccess } from '../middleware/auth';
import { logger } from '../lib/logger';
import { messageWithReplySelect } from '../services/MessageService';

const router = Router();

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
