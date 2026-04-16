'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getSocket, disconnectSocket } from '@/lib/socket';
import type { ServerToClientEvents } from '@/types';
import { Socket } from 'socket.io-client';

type TypedSocket = Socket<ServerToClientEvents, Record<string, (...args: unknown[]) => void>>;

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);

  useEffect(() => {
    socketRef.current = getSocket() as TypedSocket;

    return () => {
      // Don't disconnect on unmount — socket is shared
    };
  }, []);

  const on = useCallback(<E extends keyof ServerToClientEvents>(
    event: E,
    handler: ServerToClientEvents[E]
  ) => {
    const socket = socketRef.current || getSocket() as TypedSocket;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).on(event, handler);
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (socket as any).off(event, handler);
    };
  }, []);

  const emit = useCallback((event: string, ...args: unknown[]) => {
    const socket = socketRef.current || getSocket() as TypedSocket;
    socket.emit(event, ...args);
  }, []);

  const joinConversation = useCallback((conversationId: string) => {
    emit('conversation:join', conversationId);
  }, [emit]);

  const leaveConversation = useCallback((conversationId: string) => {
    emit('conversation:leave', conversationId);
  }, [emit]);

  return {
    socket: socketRef.current,
    on,
    emit,
    joinConversation,
    leaveConversation,
    disconnect: disconnectSocket,
  };
}
