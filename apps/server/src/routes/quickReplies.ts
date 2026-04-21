import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logger } from '../lib/logger';

const router = Router();
router.use(authMiddleware());

const quickReplySchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(5000),
});

// GET /api/quick-replies
router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const items = await prisma.quickReply.findMany({ orderBy: { createdAt: 'asc' } });
    res.json({ data: items });
  } catch (error) {
    logger.error('List quick replies error', { error });
    res.status(500).json({ error: 'Failed to list quick replies' });
  }
});

// POST /api/quick-replies
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = quickReplySchema.parse(req.body);
    const item = await prisma.quickReply.create({ data });
    res.status(201).json({ data: item });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Create quick reply error', { error });
    res.status(500).json({ error: 'Failed to create quick reply' });
  }
});

// PUT /api/quick-replies/:id
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = quickReplySchema.parse(req.body);
    const item = await prisma.quickReply.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ data: item });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Update quick reply error', { error });
    res.status(500).json({ error: 'Failed to update quick reply' });
  }
});

// DELETE /api/quick-replies/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.quickReply.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    logger.error('Delete quick reply error', { error });
    res.status(500).json({ error: 'Failed to delete quick reply' });
  }
});

export default router;
