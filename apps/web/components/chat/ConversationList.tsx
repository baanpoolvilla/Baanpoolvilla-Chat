'use client';

import { useState, useEffect } from 'react';
import { useConversations } from '@/hooks/useConversations';
import ConversationItem from './ConversationItem';
import type { Conversation, ConversationStatus, Platform } from '@/types';
import { Search, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConversationListProps {
  activeId?: string;
  onSelect: (conversation: Conversation) => void;
  onContactRenamed?: (contactId: string, displayName: string) => void;
  registerContactRenamer?: (fn: (contactId: string, displayName: string) => void) => void;
}

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
  const { conversations, isLoading, filters, setFilters, updateContactName, markConversationRead } = useConversations();

  useEffect(() => {
    if (registerContactRenamer) {
      registerContactRenamer(updateContactName);
    }
  }, [registerContactRenamer, updateContactName]);

  useEffect(() => {
    if (activeId) {
      markConversationRead(activeId);
    }
  }, [activeId, markConversationRead]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setFilters({ ...filters, search: value || undefined });
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col border-r border-gray-200 bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">Conversations</h2>
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

        {/* Filters */}
        {showFilters && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-1 flex-wrap">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    setFilters({ ...filters, status: (opt.value || undefined) as ConversationStatus | undefined })
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
                setFilters({ ...filters, platform: (e.target.value || undefined) as Platform | undefined })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
            >
              {platformOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No conversations found
          </div>
        ) : (
          <div className="space-y-0.5 p-2">
            {conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeId}
                onClick={() => {
                  markConversationRead(conv.id);
                  onSelect(conv);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
