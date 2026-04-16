import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logger } from '../lib/logger';
import { Platform, Prisma } from '@prisma/client';
import { LineService } from '../services/platforms/LineService';

const router = Router();
router.use(authMiddleware());

// Helper — flatten config JSON to flat response object
function flattenConfig(c: { id: string; platform: Platform; config: unknown; isActive: boolean }) {
  const cfg = (c.config ?? {}) as Record<string, unknown>;
  const metadata = (cfg.metadata ?? null) as Record<string, unknown> | null;

  return {
    id: c.id,
    platform: c.platform,
    channelId: typeof cfg.channelId === 'string' ? cfg.channelId : '',
    channelSecret: typeof cfg.channelSecret === 'string' ? cfg.channelSecret : '',
    accessToken: typeof cfg.accessToken === 'string' ? cfg.accessToken : '',
    isActive: c.isActive,
    metadata,
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

    let metadata: Record<string, string> | undefined;
    if (data.platform === 'LINE' && data.accessToken) {
      try {
        const botInfo = await LineService.getBotInfoByToken(data.accessToken);
        metadata = {
          oaName: botInfo.displayName || '',
          oaUserId: botInfo.userId || '',
          oaBasicId: botInfo.basicId || '',
          oaPictureUrl: botInfo.pictureUrl || '',
        };
      } catch (lineInfoError) {
        logger.warn('Failed to fetch LINE OA info from access token', { lineInfoError });
      }
    }

    const configJson: Prisma.InputJsonValue = {
      channelId: data.channelId,
      channelSecret: data.channelSecret,
      accessToken: data.accessToken,
      metadata: metadata || {},
    };

    const config = await prisma.platformConfig.upsert({
      where: { platform: data.platform },
      create: {
        platform: data.platform,
        isActive: data.isActive,
        config: configJson,
      },
      update: {
        isActive: data.isActive,
        config: configJson,
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

    const existing = await prisma.platformConfig.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Platform config not found' });
      return;
    }

    const existingCfg = (existing.config ?? {}) as Record<string, unknown>;
    let metadata = (existingCfg.metadata ?? {}) as Record<string, string>;
    if (existing.platform === 'LINE' && data.accessToken) {
      try {
        const botInfo = await LineService.getBotInfoByToken(data.accessToken);
        metadata = {
          oaName: botInfo.displayName || '',
          oaUserId: botInfo.userId || '',
          oaBasicId: botInfo.basicId || '',
          oaPictureUrl: botInfo.pictureUrl || '',
        };
      } catch (lineInfoError) {
        logger.warn('Failed to refresh LINE OA info from access token', { lineInfoError });
      }
    }

    const configJson: Prisma.InputJsonValue = {
      channelId: data.channelId,
      channelSecret: data.channelSecret,
      accessToken: data.accessToken,
      metadata,
    };

    const config = await prisma.platformConfig.update({
      where: { id: req.params.id },
      data: {
        isActive: data.isActive,
        config: configJson,
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
