import { Router, Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { LineService } from '../services/platforms/LineService';
import { logger } from '../lib/logger';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function resolvePublicBase(req: Request): string {
  const configured =
    process.env.PUBLIC_BASE_URL ||
    process.env.API_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_API_URL;

  if (configured) {
    return configured.replace(/\/api\/?$/, '').replace(/\/$/, '');
  }

  const forwardedProto = req.header('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.header('x-forwarded-host')?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const host = forwardedHost || req.get('host');

  return `${protocol}://${host}`.replace(/\/$/, '');
}

// Accept base64-encoded file: { data: string (base64), mimeType: string }
router.post('/upload', authMiddleware(), async (req: Request, res: Response): Promise<void> => {
  try {
    const { data: b64, mimeType } = req.body as { data?: string; mimeType?: string };

    if (!b64 || !mimeType) {
      res.status(400).json({ error: 'Missing data or mimeType' });
      return;
    }

    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
      'image/webp': 'webp', 'image/svg+xml': 'svg',
      'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
      'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'application/zip': 'zip',
      'application/x-rar-compressed': 'rar',
      'text/plain': 'txt',
      'text/csv': 'csv',
    };
    const ext = mimeToExt[mimeType] || mimeType.split('/')[1]?.split('+')[0]?.replace('jpeg', 'jpg') || 'bin';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const filePath = path.join(uploadDir, filename);

    const buffer = Buffer.from(b64, 'base64');

    // 25 MB limit
    if (buffer.byteLength > 25 * 1024 * 1024) {
      res.status(413).json({ error: 'File too large (max 25 MB)' });
      return;
    }

    fs.writeFileSync(filePath, buffer);

    const publicBase = resolvePublicBase(req);
    const publicUrl = `${publicBase}/uploads/${filename}`;

    res.json({
      data: {
        url: publicUrl,
        mimeType,
        size: buffer.byteLength,
      },
    });
  } catch (error) {
    logger.error('Failed to upload media', { error });
    res.status(500).json({ error: 'Failed to upload media' });
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