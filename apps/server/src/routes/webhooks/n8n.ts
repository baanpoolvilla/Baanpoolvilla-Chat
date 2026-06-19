import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AiBotService } from '../../services/AiBotService';
import { webhookLimiter } from '../../middleware/rateLimit';
import { logger } from '../../lib/logger';
import prisma from '../../lib/prisma';
import { getSocketIO } from '../../lib/socket';

const router = Router();

const replySchema = z.object({
  conversationId: z.string().min(1),
  reply: z.string().min(1),
});

const unansweredSchema = z.object({
  conversationId: z.string().min(1),
  messageText: z.string().min(1),
  contactName: z.string().optional(),
  intent: z.string().optional(),
  zone: z.string().optional(),
  code: z.string().nullable().optional(),
});

// POST /api/webhooks/n8n/reply
router.post('/reply', webhookLimiter, async (req: Request, res: Response): Promise<void> => {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (secret) {
    const incoming =
      req.headers['x-n8n-secret'] ??
      req.headers['authorization']?.toString().replace(/^Bearer\s+/i, '');
    if (incoming !== secret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.errors });
    return;
  }

  res.status(200).json({ status: 'ok' });

  const { conversationId, reply } = parsed.data;
  AiBotService.deliverBotReply(conversationId, reply).catch((err) => {
    logger.error('n8n async reply delivery failed', { error: err.message, conversationId });
  });
});

// POST /api/webhooks/n8n/unanswered
// n8n calls this when the bot cannot answer a customer message.
router.post('/unanswered', webhookLimiter, async (req: Request, res: Response): Promise<void> => {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (secret) {
    const incoming =
      req.headers['x-n8n-secret'] ??
      req.headers['authorization']?.toString().replace(/^Bearer\s+/i, '');
    if (incoming !== secret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  const parsed = unansweredSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.errors });
    return;
  }

  res.status(200).json({ status: 'ok' });

  const { conversationId, messageText, contactName, intent, zone, code } = parsed.data;
  try {
    const record = await prisma.unansweredMessage.create({
      data: {
        conversationId,
        messageText,
        contactName: contactName ?? null,
        intent: intent ?? null,
        zone: zone ?? null,
        code: code ?? null,
      },
    });

    const io = getSocketIO();
    io.emit('bot:unanswered', record);

    logger.info('Unanswered message logged', { conversationId, intent, zone });
  } catch (err) {
    logger.error('Failed to log unanswered message', { error: err, conversationId });
  }
});

// POST /api/webhooks/n8n/handover
// n8n calls this to switch conversation from Bot → Admin mode
router.post('/handover', webhookLimiter, async (req: Request, res: Response): Promise<void> => {
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (secret) {
    const incoming =
      req.headers['x-n8n-secret'] ??
      req.headers['authorization']?.toString().replace(/^Bearer\s+/i, '');
    if (incoming !== secret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  const parsed = z.object({ conversationId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.errors });
    return;
  }

  res.status(200).json({ status: 'ok' });

  const { conversationId } = parsed.data;
  try {
    const { ConversationService } = await import('../../services/ConversationService');
    await ConversationService.toggleBot(conversationId, false);
    logger.info('Bot handover to admin', { conversationId });
  } catch (err) {
    logger.error('Failed to handover conversation', { error: err, conversationId });
  }
});

// GET /api/webhooks/n8n/unanswered
router.get('/unanswered', async (req: Request, res: Response): Promise<void> => {
  try {
    const records = await prisma.unansweredMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(records);
  } catch (err) {
    logger.error('Failed to fetch unanswered messages', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
