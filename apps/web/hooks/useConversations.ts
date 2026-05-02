'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useSocket } from './useSocket';
import type { Conversation, ConversationListResponse, Platform, ConversationStatus } from '@/types';

function playNotificationSound() {
  if (typeof window === 'undefined') return;

  try {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.16, ctx.currentTime);
    master.connect(ctx.destination);

    const playNote = (startAt: number, frequency: number, duration: number) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, startAt);

      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(1, startAt + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

      oscillator.connect(gain);
      gain.connect(master);

      oscillator.start(startAt);
      oscillator.stop(startAt + duration + 0.01);
    };

    const t = ctx.currentTime;
    // Two-note chime with brighter pitch, closer to familiar chat-app tone.
    playNote(t, 1046.5, 0.11);
    playNote(t + 0.12, 1318.5, 0.14);

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 450);
  } catch {
    // Ignore audio playback errors (autoplay restrictions, unsupported browser, etc.)
  }
}

interface ConversationFilters {
  status?: ConversationStatus;
  platform?: Platform;
  tagIds?: string;
  adminId?: string;
  search?: string;
  isBot?: string;
  page?: number;
  limit?: number;
}

export function useConversations(initialFilters?: ConversationFilters) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<ConversationFilters>(initialFilters || {});
  const { on } = useSocket();

  const sortByLatestMessage = useCallback((items: Conversation[]) => {
    return [...items].sort((left, right) => {
      const leftTime = new Date(left.lastMsgAt || left.updatedAt || 0).getTime();
      const rightTime = new Date(right.lastMsgAt || right.updatedAt || 0).getTime();
      return rightTime - leftTime;
    });
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.platform) params.set('platform', filters.platform);
      if (filters.tagIds) params.set('tagIds', filters.tagIds);
      if (filters.adminId) params.set('adminId', filters.adminId);
      if (filters.search) params.set('search', filters.search);
      if (filters.isBot) params.set('isBot', filters.isBot);
      if (filters.page) params.set('page', filters.page.toString());
      if (filters.limit) params.set('limit', filters.limit.toString());

      const response = await api.get<ConversationListResponse>(`/api/conversations?${params.toString()}`);
      setConversations(sortByLatestMessage(response.data.conversations));
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters, sortByLatestMessage]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    const offUpdated = on('conversation:updated', (updated) => {
      setConversations((prev) => {
        const existingIndex = prev.findIndex((conversation) => conversation.id === updated.id);
        if (existingIndex === -1) {
          return prev;
        }

        const prevUnread = prev[existingIndex].unreadCount || 0;
        const nextUnread = updated.unreadCount ?? prevUnread;
        if (nextUnread > prevUnread) {
          playNotificationSound();
        }

        const merged = { ...prev[existingIndex], ...updated };
        const next = prev.filter((conversation) => conversation.id !== updated.id);
        return [merged, ...next];
      });
    });

    const offNew = on('conversation:new', (conversation) => {
      setConversations((prev) => {
        if ((conversation.unreadCount || 0) > 0) {
          playNotificationSound();
        }
        const next = prev.filter((item) => item.id !== conversation.id);
        return [conversation, ...next];
      });
    });

    return () => {
      offUpdated();
      offNew();
    };
  }, [on, sortByLatestMessage]);

  const updateContactName = useCallback((contactId: string, displayName: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.contact?.id === contactId
          ? { ...c, contact: { ...c.contact, displayName } }
          : c
      )
    );
  }, []);

  const markConversationRead = useCallback((conversationId: string) => {
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation
      )
    );
  }, []);

  return {
    conversations,
    pagination,
    isLoading,
    filters,
    setFilters,
    refetch: fetchConversations,
    updateContactName,
    markConversationRead,
  };
}
