import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logger } from '../lib/logger';

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
        include: {
          admin: { select: { id: true, name: true, avatar: true } },
        },
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
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = sendSchema.parse(req.body);
    const { MessageService } = await import('../services/MessageService');

    await MessageService.sendAdminMessage({
      conversationId: data.conversationId,
      adminId: req.admin!.id,
      content: data.content,
      contentType: data.contentType,
      mediaUrl: data.mediaUrl,
    });

    res.json({ message: 'Message sent' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Send message error', { error });
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
