'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useSocket } from './useSocket';
import type { Message, MessageListResponse } from '@/types';

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const { on, joinConversation, leaveConversation } = useSocket();

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
          // replace temp optimistic message if content matches
          const tempIdx = prev.findIndex((m) => m.id.startsWith('temp-') && m.content === message.content && m.contentType === message.contentType);
          if (tempIdx !== -1) {
            const next = [...prev];
            next[tempIdx] = message;
            return next;
          }
          return [...prev, message];
        });
      }
    });

    return () => {
      offNew();
    };
  }, [conversationId, on]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      fetchMessages(page + 1, true);
    }
  }, [isLoading, hasMore, page, fetchMessages]);

  const sendMessage = useCallback(async (content: string, contentType = 'TEXT', mediaUrl?: string) => {
    if (!conversationId) return;

    // Optimistic update — show message immediately
    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      conversationId,
      content,
      contentType: contentType as Message['contentType'],
      mediaUrl,
      senderType: 'ADMIN',
      isRead: true,
      sentAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMessage]);

    try {
      const res = await api.post('/api/messages', {
        conversationId,
        content,
        contentType,
        mediaUrl,
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
    sendMessage,
    refetch: () => fetchMessages(1),
  };
}
