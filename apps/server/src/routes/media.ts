import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { LineService } from '../services/platforms/LineService';
import { logger } from '../lib/logger';
import prisma from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import {
  UPLOAD_DIR,
  MAX_MEDIA_BYTES,
  extFromMime,
  randomFilename,
  resolvePublicBase,
  publicUploadUrl,
  isLocalUploadUrl,
  saveRemoteMedia,
} from '../lib/mediaStore';

const router = Router();

// ─── Multipart upload (แนะนำ) ─────────────────────────────────────────────
// เดิมใช้ base64 ใน JSON: ไฟล์ใหญ่ขึ้น ~33%, ต้องอ่านทั้งก้อนเข้า RAM และชน limit 50 MB ของ express.json
// ตัวนี้ stream ลงดิสก์ตรง ๆ รองรับได้ถึง ~95 MB (เพดาน Cloudflare tunnel 100 MB)
const multipartUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, randomFilename(extFromMime(file.mimetype))),
  }),
  limits: { fileSize: MAX_MEDIA_BYTES, files: 1 },
});

router.post(
  '/upload-file',
  authMiddleware(),
  (req: Request, res: Response, next: NextFunction) => {
    multipartUpload.single('file')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: `File too large (max ${Math.floor(MAX_MEDIA_BYTES / 1024 / 1024)} MB)` });
        return;
      }
      if (err) {
        logger.error('Multipart upload failed', { error: err instanceof Error ? err.message : String(err) });
        res.status(500).json({ error: 'Failed to upload media' });
        return;
      }
      next();
    });
  },
  (req: Request, res: Response): void => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Missing file' });
      return;
    }
    res.json({
      data: {
        url: publicUploadUrl(resolvePublicBase(req), file.filename),
        mimeType: file.mimetype,
        size: file.size,
      },
    });
  },
);

// ─── Legacy: base64 ใน JSON { data, mimeType } — เก็บไว้ให้ client เก่ายังใช้ได้ ─────
router.post('/upload', authMiddleware(), async (req: Request, res: Response): Promise<void> => {
  try {
    const { data: b64, mimeType } = req.body as { data?: string; mimeType?: string };

    if (!b64 || !mimeType) {
      res.status(400).json({ error: 'Missing data or mimeType' });
      return;
    }

    const buffer = Buffer.from(b64, 'base64');

    // 25 MB limit (express.json จำกัด body ไว้ 50 MB → base64 ของไฟล์ ~37 MB)
    if (buffer.byteLength > 25 * 1024 * 1024) {
      res.status(413).json({ error: 'File too large (max 25 MB)' });
      return;
    }

    const filename = randomFilename(extFromMime(mimeType));
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);

    res.json({
      data: {
        url: publicUploadUrl(resolvePublicBase(req), filename),
        mimeType,
        size: buffer.byteLength,
      },
    });
  } catch (error) {
    logger.error('Failed to upload media', { error });
    res.status(500).json({ error: 'Failed to upload media' });
  }
});

// ─── กู้รูปที่เปิดไม่ได้ (ลิงก์ CDN หมดอายุ) ─────────────────────────────────
// หน้าแชทเรียกเมื่อ <img> โหลดไม่ขึ้น: ขอ URL ใหม่จากแพลตฟอร์ม → โหลดมาเก็บเอง → อัปเดต DB
// ครั้งต่อไปจะเปิดจากเซิร์ฟเวอร์เราโดยตรง ไม่หมดอายุอีก
async function fetchFreshMetaAttachmentUrl(platformMsgId: string): Promise<string | null> {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
  if (!accessToken) return null;

  const response = await axios.get(`https://graph.facebook.com/v19.0/${encodeURIComponent(platformMsgId)}`, {
    params: {
      fields: 'attachments{image_data,video_data,file_url}',
      access_token: accessToken,
    },
    timeout: 15_000,
  });

  const att = response.data?.attachments?.data?.[0];
  return att?.image_data?.url || att?.video_data?.url || att?.file_url || null;
}

router.post('/refresh/:messageId', authMiddleware(), async (req: Request, res: Response): Promise<void> => {
  const { messageId } = req.params;

  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        mediaUrl: true,
        platformMsgId: true,
        conversation: { select: { platform: true } },
      },
    });

    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    // ไฟล์อยู่บนเซิร์ฟเวอร์เราแล้วและยังมีอยู่ → ไม่ต้องทำอะไร
    if (isLocalUploadUrl(message.mediaUrl)) {
      const existing = path.join(UPLOAD_DIR, path.basename(message.mediaUrl!));
      if (fs.existsSync(existing)) {
        res.json({ data: { url: message.mediaUrl } });
        return;
      }
    }

    if (!message.platformMsgId) {
      res.status(410).json({ error: 'Media is no longer available' });
      return;
    }

    let filename: string | null = null;
    const platform = message.conversation.platform;

    if (platform === 'LINE') {
      const dl = await LineService.downloadMedia(message.platformMsgId);
      filename = dl?.filename ?? null;
    } else if (platform === 'FACEBOOK' || platform === 'INSTAGRAM') {
      const freshUrl = await fetchFreshMetaAttachmentUrl(message.platformMsgId).catch((err) => {
        logger.warn('Graph API attachment lookup failed', {
          messageId,
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      });
      if (freshUrl) {
        filename = await saveRemoteMedia(freshUrl, {
          prefix: platform === 'FACEBOOK' ? 'fb' : 'ig',
          key: message.platformMsgId,
        });
      }
    }

    if (!filename) {
      res.status(410).json({ error: 'Media is no longer available' });
      return;
    }

    const url = publicUploadUrl(resolvePublicBase(req), filename);
    await prisma.message.update({ where: { id: message.id }, data: { mediaUrl: url } });
    logger.info('Recovered expired media', { messageId, platform });
    res.json({ data: { url } });
  } catch (error) {
    logger.error('Failed to refresh media', {
      messageId,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Failed to refresh media' });
  }
});

router.get('/line/:messageId', async (req: Request, res: Response): Promise<void> => {
  const { messageId } = req.params;

  try {
    const accessToken = await LineService.getAccessToken();
    if (!accessToken) {
      res.status(503).json({ error: 'LINE access token is not configured' });
      return;
    }

    const lineResponse = await axios.get<NodeJS.ReadableStream>(
      `https://api-data.line.me/v2/bot/message/${messageId}/content`,
      {
        responseType: 'stream',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const contentType = lineResponse.headers['content-type'] || 'application/octet-stream';
    const contentLength = lineResponse.headers['content-length'];

    res.setHeader('Content-Type', contentType);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    res.setHeader('Cache-Control', 'private, max-age=300');

    lineResponse.data.pipe(res);
  } catch (error) {
    logger.error('Failed to proxy LINE media', { error, messageId });
    res.status(502).json({ error: 'Failed to fetch media from LINE' });
  }
});

export default router;
