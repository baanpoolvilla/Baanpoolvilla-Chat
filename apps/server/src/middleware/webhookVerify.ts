import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../lib/logger';
import prisma from '../lib/prisma';

export function verifyLineSignature(req: Request, res: Response, next: NextFunction): void {
  // async wrapper — we need to await DB lookup
  (async () => {
    try {
      // Try DB first, fall back to env
      let channelSecret = process.env.LINE_CHANNEL_SECRET;
      try {
        const cfg = await prisma.platformConfig.findUnique({ where: { platform: 'LINE' } });
        if (cfg) {
          const c = cfg.config as Record<string, string>;
          if (c?.channelSecret) channelSecret = c.channelSecret;
        }
      } catch { /* ignore DB error, use env fallback */ }

      if (!channelSecret) {
        logger.warn('LINE_CHANNEL_SECRET not configured');
        res.status(500).json({ error: 'LINE webhook not configured' });
        return;
      }

      const signature = req.headers['x-line-signature'] as string;
      if (!signature) {
        res.status(401).json({ error: 'Missing LINE signature' });
        return;
      }

      const body = JSON.stringify(req.body);
      const hash = crypto
        .createHmac('SHA256', channelSecret)
        .update(body)
        .digest('base64');

      if (hash !== signature) {
        logger.warn('Invalid LINE webhook signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      next();
    } catch (error) {
      logger.error('LINE signature verification error', { error });
      res.status(500).json({ error: 'Verification failed' });
    }
  })();
}

export function verifyFacebookSignature(req: Request, res: Response, next: NextFunction): void {
  try {
    if (req.method === 'GET') {
      next();
      return;
    }

    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      logger.warn('META_APP_SECRET not configured');
      res.status(500).json({ error: 'Facebook webhook not configured' });
      return;
    }

    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) {
      res.status(401).json({ error: 'Missing Facebook signature' });
      return;
    }

    const body = JSON.stringify(req.body);
    const expectedSignature =
      'sha256=' +
      crypto.createHmac('sha256', appSecret).update(body).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      logger.warn('Invalid Facebook webhook signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    next();
  } catch (error) {
    logger.error('Facebook signature verification error', { error });
    res.status(500).json({ error: 'Verification failed' });
  }
}

export function verifyInstagramSignature(req: Request, res: Response, next: NextFunction): void {
  verifyFacebookSignature(req, res, next);
}

export function verifyTikTokSignature(req: Request, res: Response, next: NextFunction): void {
  try {
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    if (!clientSecret) {
      logger.warn('TIKTOK_CLIENT_SECRET not configured');
      res.status(500).json({ error: 'TikTok webhook not configured' });
      return;
    }

    const signature = req.headers['x-tiktok-signature'] as string;
    if (!signature) {
      res.status(401).json({ error: 'Missing TikTok signature' });
      return;
    }

    const body = JSON.stringify(req.body);
    const hash = crypto
      .createHmac('sha256', clientSecret)
      .update(body)
      .digest('hex');

    if (hash !== signature) {
      logger.warn('Invalid TikTok webhook signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    next();
  } catch (error) {
    logger.error('TikTok signature verification error', { error });
    res.status(500).json({ error: 'Verification failed' });
  }
}
