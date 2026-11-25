import { Router, Request, Response } from 'express';
import { MessageService, IncomingMessage } from '../../services/MessageService';
import { LineService } from '../../services/platforms/LineService';
import { verifyLineSignature } from '../../middleware/webhookVerify';
import { webhookLimiter } from '../../middleware/rateLimit';
import { logger } from '../../lib/logger';

const router = Router();

/**
 * LINE ตอบกลับได้ครั้งเดียวและ (โดยดีฟอลต์) ไม่ส่งซ้ำ — ข้อความที่ ingest พลาด
 * จะหายถาวร จึงต้อง retry ในโปรเซสก่อน แล้วค่อยยอมแพ้พร้อม log ที่ค้นหาได้
 */
async function ingestWithRetry(incoming: IncomingMessage, attempts = 3): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await MessageService.ingest(incoming);
      if (attempt > 1) {
        logger.warn('LINE message ingested after retry', {
          platformMsgId: incoming.platformMsgId,
          attempt,
        });
      }
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      logger.warn('LINE ingest attempt failed, retrying', {
        platformMsgId: incoming.platformMsgId,
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
}

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

    // log ขาเข้าไว้เทียบกับที่บันทึกลง DB — ใช้ยืนยันว่า LINE ส่งมาถึงจริงไหม
    logger.info('LINE webhook received', {
      deliveryAttempt: req.headers['x-line-delivery-attempt'] ?? null,
      events: events.map((e: { type?: string; message?: { id?: string; type?: string } }) => ({
        type: e?.type,
        messageId: e?.message?.id,
        messageType: e?.message?.type,
      })),
    });

    for (const event of events) {
      if (event.type !== 'message') continue;

      try {
        // แชทกลุ่ม/ห้อง: LINE จะไม่ส่ง userId มาถ้าผู้ใช้ยังไม่ยอมรับ ToS ของ OA
        // เดิมจะกลายเป็น undefined แล้ว Prisma throw → ข้อความหายทั้งข้อความ
        const platformUid: string | undefined =
          event.source?.userId || event.source?.groupId || event.source?.roomId;
        if (!platformUid) {
          logger.error('LINE event without any source id — skipped', {
            messageId: event.message?.id,
            sourceType: event.source?.type,
          });
          continue;
        }

        let content = '';
        let contentType: IncomingMessage['contentType'] = 'TEXT';
        let mediaUrl: string | undefined;

        switch (event.message.type) {
          case 'text':
            content = event.message.text;
            contentType = 'TEXT';
            break;
          case 'image': {
            content = '[Image]';
            contentType = 'IMAGE';
            const imgDl = await LineService.downloadMedia(event.message.id);
            mediaUrl = imgDl
              ? `${apiBaseUrl}/uploads/${imgDl.filename}`
              : `${apiBaseUrl}/api/media/line/${event.message.id}`;
            break;
          }
          case 'video': {
            content = '[Video]';
            contentType = 'VIDEO';
            const vidDl = await LineService.downloadMedia(event.message.id);
            mediaUrl = vidDl
              ? `${apiBaseUrl}/uploads/${vidDl.filename}`
              : `${apiBaseUrl}/api/media/line/${event.message.id}`;
            break;
          }
          case 'audio': {
            content = '[Audio]';
            contentType = 'AUDIO';
            const audDl = await LineService.downloadMedia(event.message.id);
            mediaUrl = audDl
              ? `${apiBaseUrl}/uploads/${audDl.filename}`
              : `${apiBaseUrl}/api/media/line/${event.message.id}`;
            break;
          }
          case 'file': {
            content = event.message.fileName || '[File]';
            contentType = 'FILE';
            const fileDl = await LineService.downloadMedia(event.message.id);
            mediaUrl = fileDl
              ? `${apiBaseUrl}/uploads/${fileDl.filename}`
              : `${apiBaseUrl}/api/media/line/${event.message.id}`;
            break;
          }
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

        let displayName = event.source?.userId ? 'LINE User' : 'LINE Group';
        let avatarUrl: string | undefined;

        if (event.source?.userId) {
          try {
            const profile = await LineService.getProfile(event.source.userId);
            displayName = profile.displayName;
            avatarUrl = profile.pictureUrl;
          } catch (profileError) {
            // ชื่อไม่ได้ก็ไม่เป็นไร ห้ามให้ข้อความหายเพราะเรื่องนี้
            logger.warn('Failed to get LINE profile', { userId: event.source.userId });
          }
        }

        const incoming: IncomingMessage = {
          platform: 'LINE',
          platformUid,
          platformMsgId: event.message.id,
          channelId: event.source.groupId || event.source.roomId || platformUid,
          displayName,
          avatarUrl,
          content,
          contentType,
          mediaUrl,
          timestamp: event.timestamp, // LINE event timestamp (ms) — used for correct sentAt ordering
          metadata: {
            quoteToken: (event.message.quoteToken as string | undefined) ?? null,
            quotedMessageId: (event.message.quotedMessageId as string | undefined) ?? null,
            event,
          },
        };

        await ingestWithRetry(incoming);
      } catch (eventError) {
        // ถึงตรงนี้ = ข้อความลูกค้าหายจริง ค้นด้วย "LINE MESSAGE LOST" ใน log ได้
        logger.error('LINE MESSAGE LOST — failed to process event after retries', {
          error: eventError instanceof Error ? eventError.message : String(eventError),
          stack: eventError instanceof Error ? eventError.stack : undefined,
          eventType: event.message?.type,
          messageId: event.message?.id,
          userId: event.source?.userId,
          timestamp: event.timestamp,
        });
      }
    }
  } catch (error) {
    logger.error('LINE webhook processing error', { error });
  }
});

export default router;
