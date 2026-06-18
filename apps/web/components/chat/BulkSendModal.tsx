'use client';

import { useState, useEffect } from 'react';
import { X, Search, Send, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import type { Conversation } from '@/types';
import { cn } from '@/lib/utils';
import PlatformBadge from '@/components/common/PlatformBadge';

interface BulkSendModalProps {
  onClose: () => void;
}

type SendResult = { conversationId: string; success: boolean; error?: string };

export default function BulkSendModal({ onClose }: BulkSendModalProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ conversations: Conversation[] }>('/api/conversations', {
        params: { limit: 200 },
      })
      .then((r) => setConversations(r.data.conversations ?? []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = conversations.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.contact.displayName.toLowerCase().includes(q) ||
      (c.lastMessage ?? '').toLowerCase().includes(q)
    );
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const handleSend = async () => {
    if (!content.trim() || selected.size === 0) return;
    setIsSending(true);
    try {
      const res = await api.post<{ results: SendResult[] }>('/api/messages/bulk-send', {
        conversationIds: Array.from(selected),
        content: content.trim(),
        contentType: 'TEXT',
      });
      setResults(res.data.results);
    } catch {
      // silent — user can retry
    } finally {
      setIsSending(false);
    }
  };

  const allFilteredSelected = filtered.length > 0 && selected.size === filtered.length;
  const successCount = results?.filter((r) => r.success).length ?? 0;
  const failCount = results?.filter((r) => !r.success).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">ส่งข้อความหลายแชท</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {results ? (
          /* Results */
          <div className="flex flex-col items-center justify-center gap-3 p-10">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">
                {successCount} / {results.length}
              </p>
              <p className="mt-1 text-gray-500">ส่งสำเร็จ</p>
            </div>
            {failCount > 0 && (
              <p className="text-sm text-red-500">{failCount} รายการส่งไม่สำเร็จ</p>
            )}
            <button
              onClick={onClose}
              className="mt-4 rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              ปิด
            </button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row overflow-hidden">
            {/* Left — conversation selector */}
            <div className="flex min-h-0 flex-col border-b border-gray-200 md:w-1/2 md:border-b-0 md:border-r">
              <div className="flex-shrink-0 p-3 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาแชท..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    เลือกแล้ว{' '}
                    <span className="font-semibold text-brand-600">{selected.size}</span> แชท
                  </span>
                  <button
                    onClick={toggleAll}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    {allFilteredSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto max-h-52 md:max-h-none">
                {isLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="py-10 text-center text-sm text-gray-400">ไม่พบแชท</p>
                ) : (
                  filtered.map((conv) => {
                    const isChecked = selected.has(conv.id);
                    return (
                      <button
                        key={conv.id}
                        onClick={() => toggleSelect(conv.id)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50',
                          isChecked && 'bg-brand-50 hover:bg-brand-50'
                        )}
                      >
                        {/* Checkbox */}
                        <div
                          className={cn(
                            'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors',
                            isChecked ? 'border-brand-600 bg-brand-600' : 'border-gray-300 bg-white'
                          )}
                        >
                          {isChecked && (
                            <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                              <path
                                d="M2 6l3 3 5-5"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-gray-900">
                              {conv.contact.displayName}
                            </span>
                            <PlatformBadge platform={conv.platform} compact showLabel={false} />
                          </div>
                          {conv.lastMessage && (
                            <p className="truncate text-xs text-gray-400">{conv.lastMessage}</p>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right — message composer */}
            <div className="flex flex-shrink-0 flex-col gap-3 p-4 md:w-1/2 md:flex-1">
              <label className="text-sm font-medium text-gray-700">ข้อความที่จะส่ง</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="พิมพ์ข้อความ..."
                className="flex-1 resize-none rounded-lg border border-gray-300 p-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 min-h-[160px]"
              />
              <button
                onClick={handleSend}
                disabled={!content.trim() || selected.size === 0 || isSending}
                className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isSending ? 'กำลังส่ง...' : `ส่งถึง ${selected.size} แชท`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
