import { Router, Request, Response } from 'express';
import { MessageService, IncomingMessage } from '../../services/MessageService';
import { verifyInstagramSignature } from '../../middleware/webhookVerify';
import { webhookLimiter } from '../../middleware/rateLimit';
import { logger } from '../../lib/logger';

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    logger.info('Instagram webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

router.post('/', webhookLimiter, verifyInstagramSignature, async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ status: 'ok' });

  try {
    const { entry } = req.body;
    if (!entry || !Array.isArray(entry)) return;

    for (const entryItem of entry) {
      const messaging = entryItem.messaging;
      if (!messaging) continue;

      for (const event of messaging) {
        if (!event.message) continue;

        const senderId = event.sender.id;
        let content = '';
        let contentType: IncomingMessage['contentType'] = 'TEXT';
        let mediaUrl: string | undefined;

        if (event.message.text) {
          content = event.message.text;
          contentType = 'TEXT';
        } else if (event.message.attachments) {
          const attachment = event.message.attachments[0];
          switch (attachment.type) {
            case 'image':
              content = '[Image]';
              contentType = 'IMAGE';
              mediaUrl = attachment.payload.url;
              break;
            case 'video':
              content = '[Video]';
              contentType = 'VIDEO';
              mediaUrl = attachment.payload.url;
              break;
            case 'story_mention':
              content = '[Story Mention]';
              contentType = 'IMAGE';
              mediaUrl = attachment.payload.url;
              break;
            default:
              content = `[${attachment.type}]`;
          }
        }

        const incoming: IncomingMessage = {
          platform: 'INSTAGRAM',
          platformUid: senderId,
          platformMsgId: event.message.mid,
          channelId: entryItem.id,
          displayName: 'Instagram User',
          content,
          contentType,
          mediaUrl,
          metadata: { event },
        };

        await MessageService.ingest(incoming);
      }
    }
  } catch (error) {
    logger.error('Instagram webhook processing error', { error });
  }
});

export default router;
