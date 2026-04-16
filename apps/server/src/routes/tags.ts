import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logger } from '../lib/logger';

const router = Router();

router.use(authMiddleware());

// ─── Tag Categories ──────────────────────────────────────

router.get('/categories', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categories = await prisma.tagCategory.findMany({
      include: { tags: true },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (error) {
    logger.error('List tag categories error', { error });
    res.status(500).json({ error: 'Failed to list categories' });
  }
});

const categorySchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
});

router.post('/categories', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = categorySchema.parse(req.body);
    const category = await prisma.tagCategory.create({ data });
    res.status(201).json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Create tag category error', { error });
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/categories/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = categorySchema.parse(req.body);
    const category = await prisma.tagCategory.update({
      where: { id: req.params.id },
      data,
    });
    res.json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Update tag category error', { error });
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/categories/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.tagCategory.delete({ where: { id: req.params.id } });
    res.json({ message: 'Category deleted' });
  } catch (error) {
    logger.error('Delete tag category error', { error });
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ─── Tags ────────────────────────────────────────────────

router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tags = await prisma.tag.findMany({
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    res.json(tags);
  } catch (error) {
    logger.error('List tags error', { error });
    res.status(500).json({ error: 'Failed to list tags' });
  }
});

const tagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
  categoryId: z.string().cuid().nullish(),
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = tagSchema.parse(req.body);
    const tag = await prisma.tag.create({
      data: {
        name: data.name,
        color: data.color,
        categoryId: data.categoryId ?? undefined,
      },
      include: { category: true },
    });
    res.status(201).json(tag);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Create tag error', { error });
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = tagSchema.parse(req.body);
    const tag = await prisma.tag.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        color: data.color,
        categoryId: data.categoryId ?? undefined,
      },
      include: { category: true },
    });
    res.json(tag);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Update tag error', { error });
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.tag.delete({ where: { id: req.params.id } });
    res.json({ message: 'Tag deleted' });
  } catch (error) {
    logger.error('Delete tag error', { error });
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

export default router;
