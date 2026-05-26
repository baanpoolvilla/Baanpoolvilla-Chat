'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, MessageSquare, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { FaLine, FaFacebook, FaInstagram, FaTiktok } from 'react-icons/fa6';
import api from '@/lib/api';
import { cn, formatTimeAgo, withAlpha } from '@/lib/utils';
import type { Contact, Platform, Tag } from '@/types';
import ContactDetailDrawer from '@/components/contacts/ContactDetailDrawer';

const PLATFORM_OPTIONS: { value: Platform | ''; label: string }[] = [
  { value: '', label: 'ทุกแพลตฟอร์ม' },
  { value: 'LINE', label: 'LINE' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'TIKTOK', label: 'TikTok' },
  { value: 'MANUAL', label: 'Manual' },
];

function PlatformIcon({ platform, size = 'sm' }: { platform: string; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  switch (platform) {
    case 'LINE': return <FaLine className={cn(cls, 'text-[#06C755]')} />;
    case 'FACEBOOK': return <FaFacebook className={cn(cls, 'text-[#1877F2]')} />;
    case 'INSTAGRAM': return <FaInstagram className={cn(cls, 'text-[#E4405F]')} />;
    case 'TIKTOK': return <FaTiktok className={cn(cls, 'text-slate-800')} />;
    default: return <MessageSquare className={cn(cls, 'text-slate-400')} />;
  }
}

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<Platform | ''>('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagFilter, setTagFilter] = useState('');
  const limit = 30;

  useEffect(() => {
    api.get('/api/tags').then((res) => {
      setAllTags(res.data.tags || res.data || []);
    });
  }, []);

  const fetchContacts = useCallback(() => {
    setLoading(true);
    const params: Record<string, string | number> = { page, limit };
    if (search) params.search = search;
    api
      .get('/api/contacts', { params })
      .then((res) => {
        setContacts(res.data.contacts || []);
        setTotal(res.data.pagination?.total || 0);
      })
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const totalPages = Math.ceil(total / limit);

  const handleContactUpdated = (updated: Contact) => {
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    if (selectedContact?.id === updated.id) {
      setSelectedContact((prev) => (prev ? { ...prev, ...updated } : prev));
    }
  };

  const goToChat = (contact: Contact) => {
    const conv = contact.conversations?.[0];
    if (conv) {
      router.push(`/conversations/${conv.id}`);
    } else {
      router.push(`/conversations?contactId=${contact.id}`);
    }
  };

  const visibleContacts = platformFilter
    ? contacts.filter((c) => c.platformLinks?.some((pl) => pl.platform === platformFilter))
    : contacts;

  const tagFilteredContacts = tagFilter
    ? visibleContacts.filter((c) => c.tags?.some((t) => t.tagId === tagFilter))
    : visibleContacts;

  return (
    <div className="flex h-full flex-col bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50">
              <Users className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">รายชื่อติดต่อ</h1>
              <p className="text-xs text-slate-400">{total.toLocaleString()} รายการ</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="ค้นหาชื่อ, อีเมล, เบอร์โทร..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-orange-400 focus:bg-white focus:ring-1 focus:ring-orange-400"
            />
          </div>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as Platform | '')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
          >
            {PLATFORM_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
          >
            <option value="">ทุกแท็ก</option>
            {allTags.map((tag) => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          </div>
        ) : tagFilteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Users className="mb-3 h-12 w-12 opacity-30" />
            <p className="text-sm">ไม่พบผู้ติดต่อ</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tagFilteredContacts.map((contact) => (
              <ContactRow
                key={contact.id}
                contact={contact}
                onChat={() => goToChat(contact)}
                onDetail={() => setSelectedContact(contact)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3">
          <p className="text-sm text-slate-500">
            หน้า {page} จาก {totalPages} ({total.toLocaleString()} รายการ)
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {selectedContact && (
        <ContactDetailDrawer
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onUpdated={handleContactUpdated}
        />
      )}
    </div>
  );
}

interface ContactRowProps {
  contact: Contact;
  onChat: () => void;
  onDetail: () => void;
}

function ContactRow({ contact, onChat, onDetail }: ContactRowProps) {
  const initials = (contact.displayName || '?').slice(0, 2).toUpperCase();
  const latestConv = contact.conversations?.[0];

  return (
    <div className="flex items-center gap-4 bg-white px-5 py-3.5 hover:bg-slate-50 transition-colors">
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {contact.avatarUrl ? (
          <img
            src={contact.avatarUrl}
            alt=""
            className="h-11 w-11 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-sm font-bold text-white">
            {initials}
          </div>
        )}
        {contact.platformLinks && contact.platformLinks.length > 0 && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow">
            <PlatformIcon platform={contact.platformLinks[0].platform} />
          </span>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-900">
            {contact.displayName}
          </span>
          {contact.isNameCustomized && (
            <span className="flex-shrink-0 rounded bg-orange-50 px-1.5 py-0.5 text-[10px] text-orange-500">
              แก้ไขชื่อ
            </span>
          )}
        </div>
        {contact.isNameCustomized && contact.originalDisplayName && (
          <p className="text-xs text-slate-400 truncate">ชื่อจริง: {contact.originalDisplayName}</p>
        )}

        {/* Tags row */}
        {contact.tags && contact.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {contact.tags.slice(0, 4).map(({ tagId, tag }) => (
              <span
                key={tagId}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: withAlpha(tag.color, 0.15),
                  color: tag.color,
                  border: `1px solid ${withAlpha(tag.color, 0.3)}`,
                }}
              >
                {tag.name}
              </span>
            ))}
            {contact.tags.length > 4 && (
              <span className="text-[10px] text-slate-400">+{contact.tags.length - 4}</span>
            )}
          </div>
        )}

        {/* Meta row */}
        <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
          {contact.platformLinks && contact.platformLinks.length > 1 && (
            <span className="flex items-center gap-1">
              {contact.platformLinks.slice(1).map((pl) => (
                <PlatformIcon key={pl.id} platform={pl.platform} />
              ))}
            </span>
          )}
          {contact._count?.conversations !== undefined && (
            <span>{contact._count.conversations} การสนทนา</span>
          )}
          {latestConv?.lastMsgAt && (
            <span>ล่าสุด {formatTimeAgo(latestConv.lastMsgAt)}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          onClick={onChat}
          title="เปิดการสนทนา"
          className="flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-100 transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          แชท
        </button>
        <button
          onClick={onDetail}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          ดูรายละเอียด
        </button>
      </div>
    </div>
  );
}
