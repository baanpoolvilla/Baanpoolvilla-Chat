import { Server as SocketIOServer, Socket } from 'socket.io';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';

interface AdminSocket extends Socket {
  adminId: string;
}

const onlineAdmins = new Map<string, Set<string>>();

export function presenceHandler(io: SocketIOServer, socket: Socket): void {
  const adminSocket = socket as AdminSocket;
  const adminId = adminSocket.adminId;

  if (!onlineAdmins.has(adminId)) {
    onlineAdmins.set(adminId, new Set());
  }
  onlineAdmins.get(adminId)!.add(socket.id);

  prisma.admin
    .update({
      where: { id: adminId },
      data: { isOnline: true, lastSeenAt: new Date() },
    })
    .then(() => {
      broadcastPresence(io);
    })
    .catch((err) => {
      logger.error('Failed to update admin online status', { error: err.message });
    });

  socket.on('disconnect', async () => {
    const sockets = onlineAdmins.get(adminId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        onlineAdmins.delete(adminId);
        try {
          await prisma.admin.update({
            where: { id: adminId },
            data: { isOnline: false, lastSeenAt: new Date() },
          });
          broadcastPresence(io);
        } catch (err) {
          logger.error('Failed to update admin offline status', { error: (err as Error).message });
        }
      }
    }
  });
}

function broadcastPresence(io: SocketIOServer): void {
  const presenceMap: Record<string, boolean> = {};
  for (const [adminId, sockets] of onlineAdmins.entries()) {
    presenceMap[adminId] = sockets.size > 0;
  }
  io.emit('admin:presence', presenceMap);
}
