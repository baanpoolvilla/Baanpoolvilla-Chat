import { Router, Request, Response } from 'express';
import { MessageService, IncomingMessage } from '../../services/MessageService';
import { verifyTikTokSignature } from '../../middleware/webhookVerify';
import { webhookLimiter } from '../../middleware/rateLimit';
import { logger } from '../../lib/logger';

const router = Router();

router.post('/', webhookLimiter, verifyTikTokSignature, async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ status: 'ok' });

  try {
    const { data } = req.body;
    if (!data) return;

    const events = Array.isArray(data) ? data : [data];

    for (const event of events) {
      if (!event.message) continue;

      let content = '';
      let contentType: IncomingMessage['contentType'] = 'TEXT';
      let mediaUrl: string | undefined;

      switch (event.message.type) {
        case 'text':
          content = event.message.text || '';
          contentType = 'TEXT';
          break;
        case 'image':
          content = '[Image]';
          contentType = 'IMAGE';
          mediaUrl = event.message.media_url;
          break;
        case 'video':
          content = '[Video]';
          contentType = 'VIDEO';
          mediaUrl = event.message.media_url;
          break;
        default:
          content = `[${event.message.type}]`;
      }

      const incoming: IncomingMessage = {
        platform: 'TIKTOK',
        platformUid: event.sender?.id || event.user_id,
        platformMsgId: event.message.id,
        channelId: event.conversation_id || event.sender?.id || 'tiktok',
        displayName: event.sender?.name || 'TikTok User',
        avatarUrl: event.sender?.avatar_url,
        content,
        contentType,
        mediaUrl,
        metadata: { event },
      };

      await MessageService.ingest(incoming);
    }
  } catch (error) {
    logger.error('TikTok webhook processing error', { error });
  }
});

export default router;
