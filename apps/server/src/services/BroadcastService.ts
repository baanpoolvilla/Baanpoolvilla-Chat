import { BroadcastTarget, Platform, ContentType, BroadcastStatus, Prisma } from '@prisma/client';
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

  static async update(id: string, params: Partial<CreateBroadcastParams>) {
    const existing = await prisma.broadcast.findUnique({ where: { id } });
    if (!existing) throw new Error('Broadcast not found');
    if (existing.status !== BroadcastStatus.DRAFT && existing.status !== BroadcastStatus.SCHEDULED) {
      throw new Error('Cannot edit a broadcast that has already been sent or is currently sending');
    }

    const newStatus = params.scheduledAt
      ? BroadcastStatus.SCHEDULED
      : params.scheduledAt === null
        ? BroadcastStatus.DRAFT
        : existing.status;

    return prisma.broadcast.update({
      where: { id },
      data: {
        ...(params.name !== undefined && { name: params.name }),
        ...(params.content !== undefined && { content: params.content }),
        ...(params.contentType !== undefined && { contentType: params.contentType }),
        ...(params.mediaUrl !== undefined && { mediaUrl: params.mediaUrl || null }),
        ...(params.platforms !== undefined && { platforms: params.platforms }),
        ...(params.targetType !== undefined && { targetType: params.targetType }),
        ...(params.tagFilter !== undefined && {
          tagFilter: params.tagFilter.length > 0 ? { tagIds: params.tagFilter } : Prisma.JsonNull,
        }),
        ...('scheduledAt' in params && { scheduledAt: params.scheduledAt ?? null, status: newStatus }),
      },
    });
  }

  static async deleteById(id: string) {
    const existing = await prisma.broadcast.findUnique({ where: { id } });
    if (!existing) throw new Error('Broadcast not found');
    if (existing.status === BroadcastStatus.SENDING) {
      throw new Error('Cannot delete a broadcast that is currently sending');
    }
    // Delete related logs first (no cascade defined on schema)
    await prisma.broadcastLog.deleteMany({ where: { broadcastId: id } });
    return prisma.broadcast.delete({ where: { id } });
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
        const tagIds = tagFilter?.tagIds ?? [];
        logger.info('BY_TAG filter', { tagFilter, tagIds, platforms: broadcast.platforms });

        if (tagIds.length > 0) {
          where.AND = [
            {
              OR: [
                { tags: { some: { tagId: { in: tagIds } } } },
                { conversations: { some: { tags: { some: { tagId: { in: tagIds } } } } } },
              ],
            },
            {
              platformLinks: { some: { platform: { in: broadcast.platforms } } },
            },
          ];
        } else {
          // No tags specified — match nothing to avoid mass-send accident
          where.id = '__no_match__';
        }
        break;
      }
    }

    const contacts = await prisma.contact.findMany({
      where,
      include: { platformLinks: true },
    });
    logger.info('getTargetContacts result', {
      targetType: broadcast.targetType,
      platforms: broadcast.platforms,
      contactCount: contacts.length,
    });
    return contacts;
  }
}
