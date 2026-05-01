import { Router, Request, Response } from 'express';
import { MessageService, IncomingMessage } from '../../services/MessageService';
import { LineService } from '../../services/platforms/LineService';
import { verifyLineSignature } from '../../middleware/webhookVerify';
import { webhookLimiter } from '../../middleware/rateLimit';
import { logger } from '../../lib/logger';

const router = Router();

function getApiBaseUrl(req: Request): string {
  const forwardedProto = req.headers['x-forwarded-proto']?.toString().split(',')[0].trim();
  const proto = forwardedProto || req.protocol || 'http';
  const host = req.headers['x-forwarded-host']?.toString() || req.get('host');

  if (host) {
    return `${proto}://${host}`;
  }

  return process.env.PUBLIC_API_URL
    || process.env.NEXT_PUBLIC_API_URL
    || `http://localhost:${process.env.PORT || '3001'}`;
}

router.post('/', webhookLimiter, verifyLineSignature, async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ status: 'ok' });

  try {
    const { events } = req.body;
    if (!events || !Array.isArray(events)) return;
    const apiBaseUrl = getApiBaseUrl(req);

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
          mediaUrl = `${apiBaseUrl}/api/media/line/${event.message.id}`;
          break;
        case 'video':
          content = '[Video]';
          contentType = 'VIDEO';
          mediaUrl = `${apiBaseUrl}/api/media/line/${event.message.id}`;
          break;
        case 'audio':
          content = '[Audio]';
          contentType = 'AUDIO';
          mediaUrl = `${apiBaseUrl}/api/media/line/${event.message.id}`;
          break;
        case 'file':
          content = event.message.fileName || '[File]';
          contentType = 'FILE';
          mediaUrl = `${apiBaseUrl}/api/media/line/${event.message.id}`;
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
