'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useSocket } from './useSocket';
import type { Conversation, ConversationListResponse, Platform, ConversationStatus } from '@/types';

function getConversationSortTime(conversation: Conversation) {
  return new Date(
    conversation.lastMsgAt || conversation.updatedAt || conversation.createdAt
  ).getTime();
}

function sortConversations(items: Conversation[]) {
  return [...items].sort((left, right) => getConversationSortTime(right) - getConversationSortTime(left));
}

function upsertConversation(items: Conversation[], incoming: Conversation) {
  const existingIndex = items.findIndex((item) => item.id === incoming.id);
  const nextItems = existingIndex === -1
    ? [incoming, ...items]
    : items.map((item) => (item.id === incoming.id ? { ...item, ...incoming } : item));

  return sortConversations(nextItems);
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
      setConversations(sortConversations(response.data.conversations));
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
      setConversations((prev) => upsertConversation(prev, updated));
    });

    const offNew = on('conversation:new', (conversation) => {
      setConversations((prev) => upsertConversation(prev, conversation));
    });

    return () => {
      offUpdated();
      offNew();
    };
  }, [on]);

  const updateContactName = useCallback((contactId: string, displayName: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.contact?.id === contactId
          ? { ...c, contact: { ...c.contact, displayName } }
          : c
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
  };
}
