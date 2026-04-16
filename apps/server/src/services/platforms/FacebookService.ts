import axios from 'axios';
import { ContentType } from '@prisma/client';
import { logger } from '../../lib/logger';

export class FacebookService {
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
              payload: { url: mediaUrl, is_reusable: true },
            },
          };
          break;
        case 'VIDEO':
          messagePayload = {
            attachment: {
              type: 'video',
              payload: { url: mediaUrl, is_reusable: true },
            },
          };
          break;
        case 'FILE':
          messagePayload = {
            attachment: {
              type: 'file',
              payload: { url: mediaUrl, is_reusable: true },
            },
          };
          break;
        case 'AUDIO':
          messagePayload = {
            attachment: {
              type: 'audio',
              payload: { url: mediaUrl, is_reusable: true },
            },
          };
          break;
        default:
          messagePayload = { text: content };
      }

      await axios.post(
        FacebookService.API_URL,
        {
          recipient: { id: recipientId },
          message: messagePayload,
          messaging_type: 'RESPONSE',
        },
        {
          params: { access_token: accessToken },
          headers: { 'Content-Type': 'application/json' },
        }
      );

      logger.debug('Facebook message sent', { recipientId });
    } catch (error) {
      logger.error('Facebook sendMessage failed', { error, recipientId });
      throw error;
    }
  }

  static async getProfile(userId: string): Promise<{ name: string; profilePic?: string }> {
    const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
    if (!accessToken) throw new Error('META_PAGE_ACCESS_TOKEN not configured');

    const response = await axios.get(`https://graph.facebook.com/v19.0/${userId}`, {
      params: {
        fields: 'name,profile_pic',
        access_token: accessToken,
      },
    });

    return {
      name: response.data.name,
      profilePic: response.data.profile_pic,
    };
  }
}
