import { Router, Response } from 'express';
import { z } from 'zod';
import { BroadcastService } from '../services/BroadcastService';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logger } from '../lib/logger';

const router = Router();

router.use(authMiddleware());

router.post('/estimate', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schema = z.object({
      targetType: z.enum(['ALL', 'BY_TAG', 'BY_PLATFORM', 'CUSTOM']),
      platforms: z.array(z.enum(['LINE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'MANUAL'])).optional(),
      tagFilter: z.array(z.string()).optional(),
    });
    const data = schema.parse(req.body);
    const contacts = await BroadcastService.getTargetContacts({
      targetType: data.targetType as import('@prisma/client').BroadcastTarget,
      platforms: (data.platforms ?? ['LINE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK']) as import('@prisma/client').Platform[],
      tagFilter: data.tagFilter ? { tagIds: data.tagFilter } : null,
    });
    res.json({ count: contacts.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Estimate broadcast error', { error });
    res.status(500).json({ error: 'Failed to estimate broadcast' });
  }
});

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const result = await BroadcastService.list(page, limit);
    res.json(result);
  } catch (error) {
    logger.error('List broadcasts error', { error });
    res.status(500).json({ error: 'Failed to list broadcasts' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const broadcast = await BroadcastService.getById(req.params.id);
    if (!broadcast) {
      res.status(404).json({ error: 'Broadcast not found' });
      return;
    }
    res.json(broadcast);
  } catch (error) {
    logger.error('Get broadcast error', { error });
    res.status(500).json({ error: 'Failed to get broadcast' });
  }
});

const createBroadcastSchema = z.object({
  name: z.string().min(1),
  content: z.string().min(1),
  contentType: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'STICKER', 'LOCATION', 'TEMPLATE']).default('TEXT'),
  mediaUrl: z.string().url().optional(),
  platforms: z.array(z.enum(['LINE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'MANUAL'])).min(1),
  targetType: z.enum(['ALL', 'BY_TAG', 'BY_PLATFORM', 'CUSTOM']),
  tagFilter: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional(),
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = createBroadcastSchema.parse(req.body);
    const broadcast = await BroadcastService.create({
      ...data,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      createdBy: req.admin!.id,
    });
    res.status(201).json(broadcast);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Create broadcast error', { error });
    res.status(500).json({ error: 'Failed to create broadcast' });
  }
});

router.post('/:id/send', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const broadcast = await BroadcastService.send(req.params.id);
    res.json(broadcast);
  } catch (error) {
    logger.error('Send broadcast error', { error });
    res.status(500).json({ error: 'Failed to send broadcast' });
  }
});

export default router;
