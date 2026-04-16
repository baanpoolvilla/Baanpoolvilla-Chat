import { Router, Request, Response } from 'express';
import { MessageService, IncomingMessage } from '../../services/MessageService';
import { LineService } from '../../services/platforms/LineService';
import { verifyLineSignature } from '../../middleware/webhookVerify';
import { webhookLimiter } from '../../middleware/rateLimit';
import { logger } from '../../lib/logger';

const router = Router();

router.post('/', webhookLimiter, verifyLineSignature, async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ status: 'ok' });

  try {
    const { events } = req.body;
    if (!events || !Array.isArray(events)) return;

    for (const event of events) {
      if (event.type !== 'message') continue;

      let content = '';
      let contentType: IncomingMessage['contentType'] = 'TEXT';
      let mediaUrl: string | undefined;

      switch (event.message.type) {
        case 'text':
          content = event.message.text;
          contentType = 'TEXT';
          break;
        case 'image':
          content = '[Image]';
          contentType = 'IMAGE';
          mediaUrl = `https://api-data.line.me/v2/bot/message/${event.message.id}/content`;
          break;
        case 'video':
          content = '[Video]';
          contentType = 'VIDEO';
          mediaUrl = `https://api-data.line.me/v2/bot/message/${event.message.id}/content`;
          break;
        case 'audio':
          content = '[Audio]';
          contentType = 'AUDIO';
          mediaUrl = `https://api-data.line.me/v2/bot/message/${event.message.id}/content`;
          break;
        case 'file':
          content = event.message.fileName || '[File]';
          contentType = 'FILE';
          mediaUrl = `https://api-data.line.me/v2/bot/message/${event.message.id}/content`;
          break;
        case 'sticker':
          content = `[Sticker: ${event.message.packageId}/${event.message.stickerId}]`;
          contentType = 'STICKER';
          break;
        case 'location':
          content = JSON.stringify({
            title: event.message.title,
            address: event.message.address,
            latitude: event.message.latitude,
            longitude: event.message.longitude,
          });
          contentType = 'LOCATION';
          break;
        default:
          content = `[${event.message.type}]`;
      }

      let displayName = 'LINE User';
      let avatarUrl: string | undefined;

      try {
        const profile = await LineService.getProfile(event.source.userId);
        displayName = profile.displayName;
        avatarUrl = profile.pictureUrl;
      } catch (profileError) {
        logger.warn('Failed to get LINE profile', { userId: event.source.userId });
      }

      const incoming: IncomingMessage = {
        platform: 'LINE',
        platformUid: event.source.userId,
        platformMsgId: event.message.id,
        channelId: event.source.groupId || event.source.roomId || event.source.userId,
        displayName,
        avatarUrl,
        content,
        contentType,
        mediaUrl,
        metadata: { event },
      };

      await MessageService.ingest(incoming);
    }
  } catch (error) {
    logger.error('LINE webhook processing error', { error });
  }
});

export default router;
