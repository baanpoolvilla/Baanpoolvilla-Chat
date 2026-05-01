import { Router, Request, Response } from 'express';
import axios from 'axios';
import { LineService } from '../services/platforms/LineService';
import { logger } from '../lib/logger';

const router = Router();

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