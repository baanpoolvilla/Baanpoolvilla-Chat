import { ConversationStatus, Platform, Priority } from '@prisma/client';
import prisma from '../lib/prisma';
import { getSocketIO } from '../lib/socket';
import { logger } from '../lib/logger';

export interface ConversationFilters {
  status?: ConversationStatus;
  platform?: Platform;
  tagIds?: string[];
  adminId?: string;
  search?: string;
  isBot?: boolean;
  page?: number;
  limit?: number;
}

export class ConversationService {
  static async list(filters: ConversationFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (filters.status) where.status = filters.status;
    if (filters.platform) where.platform = filters.platform;
    if (filters.isBot !== undefined) where.isBot = filters.isBot;

    if (filters.adminId) {
      where.assignments = {
        some: { adminId: filters.adminId },
      };
    }

    if (filters.tagIds && filters.tagIds.length > 0) {
      where.tags = {
        some: { tagId: { in: filters.tagIds } },
      };
    }

    if (filters.search) {
      where.OR = [
        { lastMessage: { contains: filters.search, mode: 'insensitive' } },
        { contact: { displayName: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          contact: true,
          tags: { include: { tag: { include: { category: true } } } },
          assignments: {
            include: { admin: { select: { id: true, name: true, avatar: true } } },
          },
          messages: {
            take: 1,
            orderBy: { sentAt: 'desc' },
          },
          notes: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: [
          { lastMsgAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ]);

    return {
      conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getById(id: string) {
    return prisma.conversation.findUnique({
      where: { id },
      include: {
        contact: {
          include: {
            platformLinks: true,
            tags: { include: { tag: true } },
          },
        },
        tags: { include: { tag: { include: { category: true } } } },
        assignments: {
          include: { admin: { select: { id: true, name: true, avatar: true, email: true } } },
        },
        notes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  static async update(id: string, data: { status?: ConversationStatus; priority?: Priority }) {
    const conversation = await prisma.conversation.update({
      where: { id },
      data,
      include: {
        contact: true,
        tags: { include: { tag: true } },
        assignments: {
          include: { admin: { select: { id: true, name: true, avatar: true } } },
        },
      },
    });

    const io = getSocketIO();
    io.emit('conversation:updated', conversation);

    return conversation;
  }

  static async toggleBot(id: string, isBot: boolean) {
    const conversation = await prisma.conversation.update({
      where: { id },
      data: { isBot },
      include: {
        contact: true,
        tags: { include: { tag: true } },
      },
    });

    const io = getSocketIO();
    io.emit('conversation:updated', conversation);
    io.to(`conversation:${id}`).emit('conversation:updated', conversation);

    logger.info(`Bot ${isBot ? 'enabled' : 'disabled'} for conversation`, { conversationId: id });

    return conversation;
  }

  static async markRead(id: string) {
    await prisma.$transaction([
      prisma.conversation.update({
        where: { id },
        data: { unreadCount: 0 },
      }),
      prisma.message.updateMany({
        where: { conversationId: id, isRead: false },
        data: { isRead: true },
      }),
    ]);
  }

  static async assign(conversationId: string, adminId: string) {
    const assignment = await prisma.conversationAssignment.create({
      data: { conversationId, adminId },
      include: {
        admin: { select: { id: true, name: true, avatar: true } },
      },
    });

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        contact: true,
        tags: { include: { tag: true } },
        assignments: {
          include: { admin: { select: { id: true, name: true, avatar: true } } },
        },
      },
    });

    const io = getSocketIO();
    io.emit('conversation:updated', conversation);

    return assignment;
  }

  static async addNote(conversationId: string, content: string, createdBy: string) {
    return prisma.conversationNote.create({
      data: { conversationId, content, createdBy },
    });
  }

  static async addTag(conversationId: string, tagId: string, adminId?: string) {
    const tag = await prisma.conversationTag.create({
      data: {
        conversationId,
        tagId,
        addedByAdminId: adminId,
      },
      include: { tag: { include: { category: true } } },
    });

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        contact: true,
        tags: { include: { tag: true } },
        assignments: {
          include: { admin: { select: { id: true, name: true, avatar: true } } },
        },
      },
    });

    const io = getSocketIO();
    io.emit('conversation:updated', conversation);

    return tag;
  }

  static async removeTag(conversationId: string, tagId: string) {
    await prisma.conversationTag.delete({
      where: {
        conversationId_tagId: { conversationId, tagId },
      },
    });

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        contact: true,
        tags: { include: { tag: true } },
        assignments: {
          include: { admin: { select: { id: true, name: true, avatar: true } } },
        },
      },
    });

    const io = getSocketIO();
    io.emit('conversation:updated', conversation);
  }
}
