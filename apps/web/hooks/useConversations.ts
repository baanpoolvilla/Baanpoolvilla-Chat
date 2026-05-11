'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useSocket } from './useSocket';
import type { Conversation, ConversationListResponse, Platform, ConversationStatus } from '@/types';

function playNotificationSound() {
  if (typeof window === 'undefined') return;

  const playSynthTone = () => {
    try {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.28, ctx.currentTime);
    master.connect(ctx.destination);

    const playNote = (startAt: number, frequency: number, duration: number) => {
      const oscillator = ctx.createOscillator();
      const harmonics = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, startAt);
      harmonics.type = 'sine';
      harmonics.frequency.setValueAtTime(frequency * 2, startAt);

      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(1, startAt + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

      oscillator.connect(gain);
      harmonics.connect(gain);
      gain.connect(master);

      oscillator.start(startAt);
      harmonics.start(startAt);
      oscillator.stop(startAt + duration + 0.01);
      harmonics.stop(startAt + duration + 0.01);
    };

    const t = ctx.currentTime;
    // Three short notes for a clearer and louder chat notification.
    playNote(t, 988.0, 0.1);
    playNote(t + 0.11, 1318.5, 0.12);
    playNote(t + 0.25, 1568.0, 0.12);

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 600);
    } catch {
    // Ignore audio playback errors (autoplay restrictions, unsupported browser, etc.)
    }
  };

  try {
    // If you place a real tone file at /public/sounds/line-message.mp3,
    // this path gives the closest result to the original app sound.
    const audio = new Audio('/sounds/line-message.mp3');
    audio.volume = 1.0;
    void audio.play().catch(() => {
      playSynthTone();
    });
  } catch {
    playSynthTone();
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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [filters, setFilters] = useState<ConversationFilters>(initialFilters || {});
  const { on } = useSocket();

  const sortByLatestMessage = useCallback((items: Conversation[]) => {
    return [...items].sort((left, right) => {
      const leftTime = new Date(left.lastMsgAt || left.updatedAt || 0).getTime();
      const rightTime = new Date(right.lastMsgAt || right.updatedAt || 0).getTime();
      return rightTime - leftTime;
    });
  }, []);

  const fetchConversations = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.platform) params.set('platform', filters.platform);
      if (filters.tagIds) params.set('tagIds', filters.tagIds);
      if (filters.adminId) params.set('adminId', filters.adminId);
      if (filters.search) params.set('search', filters.search);
      if (filters.isBot) params.set('isBot', filters.isBot);
      params.set('page', pageNum.toString());
      if (filters.limit) params.set('limit', filters.limit.toString());

      const response = await api.get<ConversationListResponse>(`/api/conversations?${params.toString()}`);
      const incoming = response.data.conversations;

      setConversations((prev) => {
        if (!append) {
          return sortByLatestMessage(incoming);
        }

        const existingIds = new Set(prev.map((conversation) => conversation.id));
        const uniqueIncoming = incoming.filter((conversation) => !existingIds.has(conversation.id));
        return [...prev, ...uniqueIncoming];
      });
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      if (append) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [filters, sortByLatestMessage]);

  useEffect(() => {
    fetchConversations(1, false);
  }, [fetchConversations]);

  const loadMore = useCallback(() => {
    if (isLoading || isLoadingMore) return;
    if (pagination.page >= pagination.totalPages) return;

    fetchConversations(pagination.page + 1, true);
  }, [fetchConversations, isLoading, isLoadingMore, pagination.page, pagination.totalPages]);

  const refetchLatest = useCallback(() => {
    fetchConversations(1, false);
  }, [fetchConversations]);

  useEffect(() => {
    const offUpdated = on('conversation:updated', (updated) => {
      setConversations((prev) => {
        const existingIndex = prev.findIndex((conversation) => conversation.id === updated.id);
        if (existingIndex === -1) {
          refetchLatest();
          if ((updated.unreadCount || 0) > 0) {
            playNotificationSound();
          }
          return prev;
        }

        const prevUnread = prev[existingIndex].unreadCount || 0;
        const nextUnread = updated.unreadCount ?? prevUnread;
        if (nextUnread > prevUnread) {
          playNotificationSound();
        }

        const merged = { ...prev[existingIndex], ...updated };
        const next = prev.filter((conversation) => conversation.id !== updated.id);
        return sortByLatestMessage([...next, merged]);
      });
    });

    const offNew = on('conversation:new', (conversation) => {
      setConversations((prev) => {
        if ((conversation.unreadCount || 0) > 0) {
          playNotificationSound();
        }
        const next = prev.filter((item) => item.id !== conversation.id);
        return sortByLatestMessage([conversation, ...next]);
      });
    });

    const offNotify = on('admin:notify', () => {
      playNotificationSound();
      refetchLatest();
    });

    return () => {
      offUpdated();
      offNew();
      offNotify();
    };
  }, [on, refetchLatest, sortByLatestMessage]);

  useEffect(() => {
    const handleFocus = () => {
      refetchLatest();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetchLatest();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refetchLatest]);

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
    hasMore: pagination.page < pagination.totalPages,
    isLoading,
    isLoadingMore,
    filters,
    setFilters,
    loadMore,
    refetch: refetchLatest,
    updateContactName,
    markConversationRead,
  };
}
