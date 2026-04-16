import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export function setSocketIO(server: SocketIOServer): void {
  io = server;
}

export function getSocketIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io not initialized. Call setSocketIO first.');
  }
  return io;
}
