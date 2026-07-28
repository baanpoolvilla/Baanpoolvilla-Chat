'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useConversations } from '@/hooks/useConversations';
import ConversationItem from './ConversationItem';
import BulkSendModal from './BulkSendModal';
import type { Conversation, ConversationStatus, Platform, Tag } from '@/types';
import { Search, Filter, X, SendHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { canWriteChat } from '@/lib/permissions';

interface ConversationListProps {
  activeId?: string;
  onSelect: (conversation: Conversation) => void;
  onContactRenamed?: (contactId: string, displayName: string) => void;
  registerContactRenamer?: (fn: (contactId: string, displayName: string) => void) => void;
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const statusOptions: { value: ConversationStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'RESOLVED', label: 'Resolved' },
];

const platformOptions: { value: Platform | ''; label: string }[] = [
  { value: '', label: 'All Platforms' },
  { value: 'LINE', label: 'LINE' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'TIKTOK', label: 'TikTok' },
];

export default function ConversationList({ activeId, onSelect, registerContactRenamer }: ConversationListProps) {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkSend, setShowBulkSend] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [noTagsFilter, setNoTagsFilter] = useState(false);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const scrollAnchorsRef = useRef<{ id: string; offset: number }[]>([]);
  const anchorFrameRef = useRef<number | null>(null);
  const admin = useAuth((s) => s.admin);
  const canModifyChat = canWriteChat(admin?.role);
  const { conversations, isLoading, isLoadingMore, hasMore, filters, setFilters, loadMore, updateContactName, markConversationRead } = useConversations();

  const handleSelectConversation = useCallback((conversation: Conversation) => {
    if (canModifyChat) {
      markConversationRead(conversation.id);
    }

    onSelect(conversation);
  }, [canModifyChat, markConversationRead, onSelect]);

  useEffect(() => {
    api.get<Tag[]>('/api/tags').then((r) => setAllTags(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      tagIds: selectedTagIds.length > 0 ? selectedTagIds.join(',') : undefined,
      noTags: noTagsFilter ? true : undefined,
    }));
  }, [selectedTagIds, noTagsFilter, setFilters]);

  const handleTagToggle = (tagId: string) => {
    setNoTagsFilter(false);
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleNoTagsToggle = () => {
    setNoTagsFilter((prev) => !prev);
    setSelectedTagIds([]);
  };

  useEffect(() => {
    if (registerContactRenamer) {
      registerContactRenamer(updateContactName);
    }
  }, [registerContactRenamer, updateContactName]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setFilters((current) => ({
        ...current,
        search: search.trim() || undefined,
      }));
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [search, setFilters]);

  useEffect(() => {
    if (activeId && canModifyChat) {
      markConversationRead(activeId);
    }
  }, [activeId, canModifyChat, markConversationRead]);

  useEffect(() => {
    if (!canModifyChat) return;

    if (!activeId) return;

    const activeConversation = conversations.find((c) => c.id === activeId);
    if (!activeConversation || (activeConversation.unreadCount || 0) <= 0) return;

    // Keep unread badge cleared while the active conversation is open.
    markConversationRead(activeId);
    api.post(`/api/conversations/${activeId}/read`).catch(() => {});
  }, [activeId, canModifyChat, conversations, markConversationRead]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          loadMore();
        }
      },
      {
        root: listContainerRef.current,
        rootMargin: '200px 0px',
        threshold: 0,
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadMore, conversations.length]);

  // Remember where the visible rows sit relative to the viewport, so an incoming
  // message that reorders the list does not drag the user away from what they read.
  const captureScrollAnchors = useCallback(() => {
    const container = listContainerRef.current;
    if (!container) return;

    if (container.scrollTop <= 0) {
      scrollAnchorsRef.current = [];
      return;
    }

    const containerTop = container.getBoundingClientRect().top;
    const containerBottom = containerTop + container.clientHeight;
    const anchors: { id: string; offset: number }[] = [];

    for (const row of Array.from(container.querySelectorAll<HTMLElement>('[data-conversation-id]'))) {
      const rect = row.getBoundingClientRect();
      if (rect.bottom <= containerTop) continue;
      if (rect.top >= containerBottom) break;

      const id = row.dataset.conversationId;
      if (id) anchors.push({ id, offset: rect.top - containerTop });
      if (anchors.length >= 8) break;
    }

    scrollAnchorsRef.current = anchors;
  }, []);

  const handleListScroll = useCallback(() => {
    if (anchorFrameRef.current !== null) return;

    anchorFrameRef.current = window.requestAnimationFrame(() => {
      anchorFrameRef.current = null;
      captureScrollAnchors();
    });
  }, [captureScrollAnchors]);

  useEffect(() => {
    return () => {
      if (anchorFrameRef.current !== null) {
        window.cancelAnimationFrame(anchorFrameRef.current);
      }
    };
  }, []);

  const conversationOrderKey = conversations.map((conversation) => conversation.id).join('|');

  useIsomorphicLayoutEffect(() => {
    const container = listContainerRef.current;
    const anchors = scrollAnchorsRef.current;
    if (!container || anchors.length === 0 || container.scrollTop <= 0) return;

    const containerTop = container.getBoundingClientRect().top;
    const deltas: number[] = [];

    for (const anchor of anchors) {
      const row = container.querySelector<HTMLElement>(`[data-conversation-id="${anchor.id}"]`);
      if (!row) continue;
      deltas.push(row.getBoundingClientRect().top - containerTop - anchor.offset);
    }

    if (deltas.length === 0) return;

    // Median, so the single row that jumped to the top of the list is ignored.
    deltas.sort((left, right) => left - right);
    const shift = deltas[Math.floor(deltas.length / 2)];
    if (Math.abs(shift) < 1) return;

    container.scrollTop += shift;
    captureScrollAnchors();
  }, [conversationOrderKey, captureScrollAnchors]);

  const handleSearch = (value: string) => {
    setSearch(value);
  };

  return (
    <>
    {showBulkSend && <BulkSendModal onClose={() => setShowBulkSend(false)} />}
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Conversations</h2>
          <div className="flex items-center gap-1">
            {canModifyChat && (
              <button
                onClick={() => setShowBulkSend(true)}
                title="ส่งข้อความหลายแชท"
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-600 transition-colors"
              >
                <SendHorizontal className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'rounded-lg p-1.5 text-gray-500 hover:bg-gray-100',
                showFilters && 'bg-brand-50 text-brand-600'
              )}
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2 pl-10 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          {search && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status tag quick filters (always visible) */}
        {allTags.filter((t) => t.category?.name === 'สถานะแชท').length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {allTags
              .filter((t) => t.category?.name === 'สถานะแชท')
              .map((tag) => {
                const active = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => handleTagToggle(tag.id)}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                      active ? 'text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                    )}
                    style={active ? { backgroundColor: tag.color, borderColor: tag.color } : undefined}
                  >
                    {tag.name}
                  </button>
                );
              })}
          </div>
        )}

        {/* Filters */}
        {showFilters && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-1 flex-wrap">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      status: (opt.value || undefined) as ConversationStatus | undefined,
                    }))
                  }
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    (filters.status || '') === opt.value
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <select
              value={filters.platform || ''}
              onChange={(e) =>
                setFilters((current) => ({
                  ...current,
                  platform: (e.target.value || undefined) as Platform | undefined,
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
            >
              {platformOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">แท็ก</p>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={handleNoTagsToggle}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                    noTagsFilter
                      ? 'border-gray-500 bg-gray-600 text-white'
                      : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                  )}
                >
                  ยังไม่มีแท็ก
                </button>
                {allTags.filter((t) => t.category?.name !== 'สถานะแชท').map((tag) => {
                  const active = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => handleTagToggle(tag.id)}
                      className={cn(
                        'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                        active ? 'text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                      )}
                      style={active ? { backgroundColor: tag.color, borderColor: tag.color } : undefined}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div
        ref={listContainerRef}
        onScroll={handleListScroll}
        className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No conversations found
          </div>
        ) : (
          <div className="divide-y divide-gray-100 sm:space-y-0.5 sm:divide-y-0 sm:p-2">
            {conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeId}
                onSelect={handleSelectConversation}
              />
            ))}
            {hasMore && (
              <div ref={loadMoreRef} className="py-3 text-center text-xs text-gray-400">
                {isLoadingMore ? 'Loading more conversations...' : 'Scroll down to load more'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
