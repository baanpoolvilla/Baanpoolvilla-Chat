import axios from 'axios';
import { ContentType } from '@prisma/client';
import { logger } from '../../lib/logger';
import prisma from '../../lib/prisma';

export class LineService {
  private static readonly API_URL = 'https://api.line.me/v2/bot/message';

  private static async getAccessToken(): Promise<string | null> {
    try {
      const cfg = await prisma.platformConfig.findUnique({ where: { platform: 'LINE' } });
      if (cfg) {
        const c = cfg.config as Record<string, string>;
        if (c?.accessToken) return c.accessToken;
      }
    } catch { /* ignore */ }
    return process.env.LINE_ACCESS_TOKEN || null;
  }

  static async sendMessage(
    recipientId: string,
    content: string,
    contentType: ContentType | string,
    mediaUrl?: string
  ): Promise<void> {
    const accessToken = await LineService.getAccessToken();
    if (!accessToken) {
      logger.warn('LINE_ACCESS_TOKEN not configured, skipping send');
      return;
    }

    try {
      let message: Record<string, unknown>;

      switch (contentType) {
        case 'IMAGE':
          message = {
            type: 'image',
            originalContentUrl: mediaUrl,
            previewImageUrl: mediaUrl,
          };
          break;
        case 'VIDEO':
          message = {
            type: 'video',
            originalContentUrl: mediaUrl,
            previewImageUrl: mediaUrl,
          };
          break;
        case 'STICKER':
          message = {
            type: 'sticker',
            packageId: '446',
            stickerId: '1988',
          };
          break;
        case 'LOCATION': {
          const loc = JSON.parse(content);
          message = {
            type: 'location',
            title: loc.title || 'Location',
            address: loc.address || '',
            latitude: loc.latitude,
            longitude: loc.longitude,
          };
          break;
        }
        default:
          message = { type: 'text', text: content };
      }

      await axios.post(
        `${LineService.API_URL}/push`,
        {
          to: recipientId,
          messages: [message],
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.debug('LINE message sent', { recipientId });
    } catch (error) {
      logger.error('LINE sendMessage failed', { error, recipientId });
      throw error;
    }
  }

  static async getProfile(userId: string): Promise<{ displayName: string; pictureUrl?: string }> {
    const accessToken = await LineService.getAccessToken();
    if (!accessToken) throw new Error('LINE_ACCESS_TOKEN not configured');

    const response = await axios.get(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return {
      displayName: response.data.displayName,
      pictureUrl: response.data.pictureUrl,
    };
  }

  static async getBotInfoByToken(accessToken: string): Promise<{
    userId?: string;
    displayName?: string;
    basicId?: string;
    pictureUrl?: string;
  }> {
    const response = await axios.get('https://api.line.me/v2/bot/info', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return {
      userId: response.data.userId,
      displayName: response.data.displayName,
      basicId: response.data.basicId,
      pictureUrl: response.data.pictureUrl,
    };
  }
}
