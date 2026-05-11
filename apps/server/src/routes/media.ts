import { Router, Request, Response } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { LineService } from '../services/platforms/LineService';
import { logger } from '../lib/logger';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeExt = ext || '.bin';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`);
    },
  }),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image and video uploads are allowed'));
  },
});

router.post('/upload', authMiddleware(), upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const publicBase =
      process.env.PUBLIC_BASE_URL ||
      process.env.API_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      `${req.protocol}://${req.get('host')}`;

    const publicUrl = `${publicBase.replace(/\/$/, '')}/uploads/${req.file.filename}`;

    res.json({
      data: {
        url: publicUrl,
        mimeType: req.file.mimetype,
        size: req.file.size,
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