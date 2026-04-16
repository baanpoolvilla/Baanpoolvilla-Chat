import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logger } from '../lib/logger';
import { Platform } from '@prisma/client';

const router = Router();
router.use(authMiddleware());

// Helper — flatten config JSON to flat response object
function flattenConfig(c: { id: string; platform: Platform; config: unknown; isActive: boolean }) {
  const cfg = (c.config ?? {}) as Record<string, string>;
  return {
    id: c.id,
    platform: c.platform,
    channelId: cfg.channelId ?? '',
    channelSecret: cfg.channelSecret ?? '',
    accessToken: cfg.accessToken ?? '',
    isActive: c.isActive,
    metadata: null,
  };
}

// GET /api/settings/platforms
router.get('/platforms', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const configs = await prisma.platformConfig.findMany({ orderBy: { platform: 'asc' } });
    res.json({ data: configs.map(flattenConfig) });
  } catch (error) {
    logger.error('List platform configs error', { error });
    res.status(500).json({ error: 'Failed to list platforms' });
  }
});

const platformSchema = z.object({
  platform: z.nativeEnum(Platform),
  channelId: z.string().optional().default(''),
  channelSecret: z.string().optional().default(''),
  accessToken: z.string().optional().default(''),
  isActive: z.boolean().optional().default(true),
});

// POST /api/settings/platforms
router.post('/platforms', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = platformSchema.parse(req.body);
    const config = await prisma.platformConfig.upsert({
      where: { platform: data.platform },
      create: {
        platform: data.platform,
        isActive: data.isActive,
        config: {
          channelId: data.channelId,
          channelSecret: data.channelSecret,
          accessToken: data.accessToken,
        },
      },
      update: {
        isActive: data.isActive,
        config: {
          channelId: data.channelId,
          channelSecret: data.channelSecret,
          accessToken: data.accessToken,
        },
      },
    });
    res.status(201).json(flattenConfig(config));
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Create platform config error', { error });
    res.status(500).json({ error: 'Failed to save platform config' });
  }
});

const updateSchema = z.object({
  channelId: z.string().optional().default(''),
  channelSecret: z.string().optional().default(''),
  accessToken: z.string().optional().default(''),
  isActive: z.boolean().optional().default(true),
});

// PUT /api/settings/platforms/:id
router.put('/platforms/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = updateSchema.parse(req.body);
    const config = await prisma.platformConfig.update({
      where: { id: req.params.id },
      data: {
        isActive: data.isActive,
        config: {
          channelId: data.channelId,
          channelSecret: data.channelSecret,
          accessToken: data.accessToken,
        },
      },
    });
    res.json(flattenConfig(config));
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
      return;
    }
    logger.error('Update platform config error', { error });
    res.status(500).json({ error: 'Failed to update platform config' });
  }
});

export default router;
