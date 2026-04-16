import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { setSocketIO } from '../lib/socket';
import { logger } from '../lib/logger';
import { chatHandler } from './chatHandler';
import { presenceHandler } from './presenceHandler';

export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_API_URL
        ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
        : '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  setSocketIO(io);

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        adminId: string;
        email: string;
        role: string;
      };
      (socket as Socket & { adminId: string; adminEmail: string; adminRole: string }).adminId = decoded.adminId;
      (socket as Socket & { adminId: string; adminEmail: string; adminRole: string }).adminEmail = decoded.email;
      (socket as Socket & { adminId: string; adminEmail: string; adminRole: string }).adminRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const adminSocket = socket as Socket & { adminId: string; adminEmail: string };
    logger.info('Socket connected', { adminId: adminSocket.adminId, socketId: socket.id });

    chatHandler(io, socket);
    presenceHandler(io, socket);

    socket.on('disconnect', () => {
      logger.info('Socket disconnected', { adminId: adminSocket.adminId, socketId: socket.id });
    });

    socket.on('error', (error) => {
      logger.error('Socket error', { error: error.message, socketId: socket.id });
    });
  });

  logger.info('Socket.io initialized');
  return io;
}
