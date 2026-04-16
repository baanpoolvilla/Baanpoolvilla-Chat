import axios from 'axios';
import { ContentType } from '@prisma/client';
import { logger } from '../../lib/logger';

export class InstagramService {
  private static readonly API_URL = 'https://graph.facebook.com/v19.0/me/messages';

  static async sendMessage(
    recipientId: string,
    content: string,
    contentType: ContentType | string,
    mediaUrl?: string
  ): Promise<void> {
    const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
    if (!accessToken) {
      logger.warn('META_PAGE_ACCESS_TOKEN not configured, skipping send');
      return;
    }

    try {
      let messagePayload: Record<string, unknown>;

      switch (contentType) {
        case 'IMAGE':
          messagePayload = {
            attachment: {
              type: 'image',
              payload: { url: mediaUrl },
            },
          };
          break;
        default:
          messagePayload = { text: content };
      }

      await axios.post(
        InstagramService.API_URL,
        {
          recipient: { id: recipientId },
          message: messagePayload,
        },
        {
          params: { access_token: accessToken },
          headers: { 'Content-Type': 'application/json' },
        }
      );

      logger.debug('Instagram message sent', { recipientId });
    } catch (error) {
      logger.error('Instagram sendMessage failed', { error, recipientId });
      throw error;
    }
  }
}
