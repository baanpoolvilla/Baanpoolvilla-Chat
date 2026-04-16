import { Server as SocketIOServer, Socket } from 'socket.io';
import { ContentType } from '@prisma/client';
import { MessageService } from '../services/MessageService';
import { ConversationService } from '../services/ConversationService';
import { logger } from '../lib/logger';

interface AdminSocket extends Socket {
  adminId: string;
}

export function chatHandler(io: SocketIOServer, socket: Socket): void {
  const adminSocket = socket as AdminSocket;

  socket.on('conversation:join', (conversationId: string) => {
    socket.join(`conversation:${conversationId}`);
    logger.debug('Admin joined conversation room', {
      adminId: adminSocket.adminId,
      conversationId,
    });
  });

  socket.on('conversation:leave', (conversationId: string) => {
    socket.leave(`conversation:${conversationId}`);
    logger.debug('Admin left conversation room', {
      adminId: adminSocket.adminId,
      conversationId,
    });
  });

  socket.on('message:send', async (data: {
    conversationId: string;
    content: string;
    contentType?: ContentType;
    mediaUrl?: string;
  }) => {
    try {
      if (!data.conversationId || !data.content) {
        socket.emit('error', { message: 'Missing required fields' });
        return;
      }

      await MessageService.sendAdminMessage({
        conversationId: data.conversationId,
        adminId: adminSocket.adminId,
        content: data.content,
        contentType: data.contentType || 'TEXT',
        mediaUrl: data.mediaUrl,
      });
    } catch (error) {
      logger.error('Socket message:send error', { error, adminId: adminSocket.adminId });
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('conversation:read', async (conversationId: string) => {
    try {
      await ConversationService.markRead(conversationId);
      io.emit('conversation:updated', { id: conversationId, unreadCount: 0 });
    } catch (error) {
      logger.error('Socket conversation:read error', { error });
    }
  });

  socket.on('conversation:assign', async (data: {
    conversationId: string;
    adminId: string;
  }) => {
    try {
      await ConversationService.assign(data.conversationId, data.adminId);
    } catch (error) {
      logger.error('Socket conversation:assign error', { error });
      socket.emit('error', { message: 'Failed to assign conversation' });
    }
  });

  socket.on('conversation:typing', (conversationId: string) => {
    socket.to(`conversation:${conversationId}`).emit('admin:typing', {
      conversationId,
      adminId: adminSocket.adminId,
    });
  });
}
