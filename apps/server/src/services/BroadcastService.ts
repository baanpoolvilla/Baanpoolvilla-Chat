import { BroadcastTarget, Platform, ContentType, BroadcastStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { broadcastQueue } from '../lib/redis';
import { logger } from '../lib/logger';

export interface CreateBroadcastParams {
  name: string;
  content: string;
  contentType: ContentType;
  mediaUrl?: string;
  platforms: Platform[];
  targetType: BroadcastTarget;
  tagFilter?: string[];
  scheduledAt?: Date;
  createdBy: string;
}

export class BroadcastService {
  static async create(params: CreateBroadcastParams) {
    const broadcast = await prisma.broadcast.create({
      data: {
        name: params.name,
        content: params.content,
        contentType: params.contentType,
        mediaUrl: params.mediaUrl,
        platforms: params.platforms,
        targetType: params.targetType,
        tagFilter: params.tagFilter ? { tagIds: params.tagFilter } : undefined,
        scheduledAt: params.scheduledAt,
        status: params.scheduledAt ? BroadcastStatus.SCHEDULED : BroadcastStatus.DRAFT,
        createdBy: params.createdBy,
      },
    });

    if (params.scheduledAt) {
      const delay = params.scheduledAt.getTime() - Date.now();
      await broadcastQueue.add(
        'send-broadcast',
        { broadcastId: broadcast.id },
        { delay: Math.max(delay, 0) }
      );
      logger.info('Broadcast scheduled', { broadcastId: broadcast.id, scheduledAt: params.scheduledAt });
    }

    return broadcast;
  }

  static async send(broadcastId: string) {
    const broadcast = await prisma.broadcast.findUnique({
      where: { id: broadcastId },
    });

    if (!broadcast) throw new Error('Broadcast not found');
    if (broadcast.status === BroadcastStatus.SENDING || broadcast.status === BroadcastStatus.COMPLETED) {
      throw new Error('Broadcast already sent or in progress');
    }

    await broadcastQueue.add('send-broadcast', { broadcastId }, { priority: 1 });

    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: BroadcastStatus.SENDING },
    });

    logger.info('Broadcast queued for immediate send', { broadcastId });
    return broadcast;
  }

  static async list(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [broadcasts, total] = await Promise.all([
      prisma.broadcast.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.broadcast.count(),
    ]);

    return {
      broadcasts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  static async getById(id: string) {
    return prisma.broadcast.findUnique({
      where: { id },
      include: {
        logs: {
          orderBy: { sentAt: 'desc' },
          take: 100,
        },
      },
    });
  }

  static async getTargetContacts(broadcast: {
    targetType: BroadcastTarget;
    platforms: Platform[];
    tagFilter: unknown;
  }) {
    const where: Record<string, unknown> = {};

    switch (broadcast.targetType) {
      case BroadcastTarget.ALL:
        where.platformLinks = {
          some: { platform: { in: broadcast.platforms } },
        };
        break;
      case BroadcastTarget.BY_PLATFORM:
        where.platformLinks = {
          some: { platform: { in: broadcast.platforms } },
        };
        break;
      case BroadcastTarget.BY_TAG: {
        const tagFilter = broadcast.tagFilter as { tagIds?: string[] } | null;
        if (tagFilter?.tagIds) {
          where.tags = {
            some: { tagId: { in: tagFilter.tagIds } },
          };
        }
        where.platformLinks = {
          some: { platform: { in: broadcast.platforms } },
        };
        break;
      }
    }

    return prisma.contact.findMany({
      where,
      include: { platformLinks: true },
    });
  }
}
