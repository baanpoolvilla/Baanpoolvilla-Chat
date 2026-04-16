'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useSocket } from './useSocket';
import type { Conversation, ConversationListResponse, Platform, ConversationStatus } from '@/types';

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
      setConversations(response.data.conversations);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    const offUpdated = on('conversation:updated', (updated) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
      );
    });

    const offNew = on('conversation:new', (conversation) => {
      setConversations((prev) => [conversation, ...prev]);
    });

    return () => {
      offUpdated();
      offNew();
    };
  }, [on]);

  return {
    conversations,
    pagination,
    isLoading,
    filters,
    setFilters,
    refetch: fetchConversations,
  };
}
