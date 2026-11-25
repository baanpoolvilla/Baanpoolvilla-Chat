'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { useSocket } from './useSocket';
import { getSocket } from '@/lib/socket';
import type { Message, MessageListResponse } from '@/types';

function createClientRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getClientRequestId(message?: Pick<Message, 'metadata'> | null) {
  const value = message?.metadata?.clientRequestId;
  return typeof value === 'string' ? value : undefined;
}

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const { on, joinConversation, leaveConversation } = useSocket();

  // refs สำหรับ ensureMessageLoaded (ทำงานข้ามหลายรอบ render)
  const messagesRef = useRef<Message[]>([]);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  messagesRef.current = messages;
  pageRef.current = page;
  hasMoreRef.current = hasMore;

  const fetchMessages = useCallback(async (pageNum = 1, append = false) => {
    if (!conversationId) return;

    try {
      setIsLoading(true);
      const response = await api.get<MessageListResponse>(
        `/api/messages?conversationId=${conversationId}&page=${pageNum}&limit=50`
      );

      const newMessages = response.data.messages;
      if (append) {
        setMessages((prev) => [...newMessages, ...prev]);
      } else {
        setMessages(newMessages);
      }

      setHasMore(pageNum < response.data.pagination.totalPages);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    setMessages([]);
    setHasMore(true);
    setPage(1);

    if (conversationId) {
      fetchMessages(1);
      joinConversation(conversationId);
    }

    return () => {
      if (conversationId) {
        leaveConversation(conversationId);
      }
    };
  }, [conversationId, fetchMessages, joinConversation, leaveConversation]);

  useEffect(() => {
    const offNew = on('message:new', (message) => {
      if (message.conversationId === conversationId) {
        setMessages((prev) => {
          // deduplicate: skip if already in list (added via optimistic or previous event)
          if (prev.some((m) => m.id === message.id)) return prev;
          const incomingClientRequestId = getClientRequestId(message);
          const tempIdx = incomingClientRequestId
            ? prev.findIndex((m) => getClientRequestId(m) === incomingClientRequestId)
            : prev.findIndex((m) => (
              m.id.startsWith('temp-')
              && m.content === message.content
              && m.contentType === message.contentType
              && m.replyToMessageId === message.replyToMessageId
            ));
          if (tempIdx !== -1) {
            const next = [...prev];
            next[tempIdx] = message;
            return next;
          }
          return [...prev, message];
        });
      }
    });

    // Re-fetch on reconnect so messages missed during WebSocket downtime are recovered
    const rawSocket = getSocket();
    const handleReconnect = () => {
      if (conversationId) fetchMessages(1);
    };
    rawSocket.on('connect', handleReconnect);

    return () => {
      offNew();
      rawSocket.off('connect', handleReconnect);
    };
  }, [conversationId, on, fetchMessages]);

  /**
   * ทำให้แน่ใจว่าข้อความ id นี้ถูกโหลดมาแสดงแล้ว — ถ้ายังไม่มี (อยู่ในหน้าเก่า)
   * จะโหลดหน้าก่อนหน้าไปเรื่อย ๆ จนเจอ ใช้ตอนกดกล่อง "ตอบกลับ" เพื่อเลื่อนไปข้อความต้นฉบับ
   */
  const ensureMessageLoaded = useCallback(async (messageId: string, maxPages = 40): Promise<boolean> => {
    if (!conversationId) return false;
    if (messagesRef.current.some((m) => m.id === messageId)) return true;

    let currentPage = pageRef.current;
    let more = hasMoreRef.current;
    setIsLoading(true);
    try {
      for (let i = 0; i < maxPages && more; i++) {
        currentPage += 1;
        const response = await api.get<MessageListResponse>(
          `/api/messages?conversationId=${conversationId}&page=${currentPage}&limit=50`
        );
        const batch = response.data.messages;
        more = currentPage < response.data.pagination.totalPages;
        pageRef.current = currentPage;
        hasMoreRef.current = more;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...batch.filter((m) => !seen.has(m.id)), ...prev];
        });
        setPage(currentPage);
        setHasMore(more);
        if (batch.some((m) => m.id === messageId)) return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to load older messages:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchMessages(page + 1, true);
    }
  }, [isLoading, hasMore, page, fetchMessages]);

  const sendMessage = useCallback(async (content: string, contentType = 'TEXT', mediaUrl?: string, replyToMessage?: Message | null) => {
    if (!conversationId) return;

    // Optimistic update — show message immediately
    const clientRequestId = createClientRequestId();
    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      conversationId,
      replyToMessageId: replyToMessage?.id,
      replyToMessage: replyToMessage ? {
        id: replyToMessage.id,
        conversationId: replyToMessage.conversationId,
        senderType: replyToMessage.senderType,
        adminId: replyToMessage.adminId,
        content: replyToMessage.content,
        contentType: replyToMessage.contentType,
        mediaUrl: replyToMessage.mediaUrl,
        sentAt: replyToMessage.sentAt,
        admin: replyToMessage.admin,
      } : null,
      content,
      contentType: contentType as Message['contentType'],
      mediaUrl,
      metadata: { clientRequestId },
      senderType: 'ADMIN',
      isRead: true,
      isPinned: false,
      sentAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMessage]);

    try {
      const res = await api.post('/api/messages', {
        conversationId,
        content,
        contentType,
        mediaUrl,
        replyToMessageId: replyToMessage?.id,
        clientRequestId,
      });
      // Replace temp with real message from server only when payload shape is valid.
      const payload = res.data as Partial<Message> | undefined;
      if (payload?.id && payload?.sentAt && payload?.conversationId) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? payload as Message : m)));
      }
    } catch (error) {
      // Remove temp on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw error;
    }
  }, [conversationId]);

  return {
    messages,
    isLoading,
    hasMore,
    loadMore,
    ensureMessageLoaded,
    sendMessage,
    refetch: () => fetchMessages(1),
  };
}
