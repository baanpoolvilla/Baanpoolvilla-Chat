import axios from 'axios';
import { ContentType } from '@prisma/client';
import { logger } from '../../lib/logger';

export class TikTokService {
  private static readonly API_URL = 'https://business-api.tiktok.com/open_api/v1.3/message/send';

  static async sendMessage(
    recipientId: string,
    content: string,
    contentType: ContentType | string,
    mediaUrl?: string
  ): Promise<void> {
    const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
    if (!accessToken) {
      logger.warn('TIKTOK_ACCESS_TOKEN not configured, skipping send');
      return;
    }

    try {
      let messagePayload: Record<string, unknown>;

      switch (contentType) {
        case 'IMAGE':
          messagePayload = {
            type: 'image',
            image: { url: mediaUrl },
          };
          break;
        default:
          messagePayload = {
            type: 'text',
            text: { content },
          };
      }

      await axios.post(
        TikTokService.API_URL,
        {
          recipient: { id: recipientId },
          message: messagePayload,
        },
        {
          headers: {
            'Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.debug('TikTok message sent', { recipientId });
    } catch (error) {
      logger.error('TikTok sendMessage failed', { error, recipientId });
      throw error;
    }
  }
}
