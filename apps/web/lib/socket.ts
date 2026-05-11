import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@/types';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

function readAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem('accessToken');
}

export function getSocket(): TypedSocket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

    socket = io(url, {
      // Use latest token for every (re)connect attempt to avoid stale auth.
      auth: (cb) => cb({ token: readAccessToken() }),
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    }) as TypedSocket;

    socket.io.on('reconnect_attempt', () => {
      socket!.auth = { token: readAccessToken() };
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function reconnectSocket(): void {
  disconnectSocket();
  getSocket();
}
