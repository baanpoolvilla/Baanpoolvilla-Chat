'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Save, RotateCcw, MessageSquare, Phone, Mail, StickyNote, Plus, Loader2 } from 'lucide-react';
import { FaLine, FaFacebook, FaInstagram, FaTiktok } from 'react-icons/fa6';
import api from '@/lib/api';
import { cn, formatTimeAgo, getTagTextColor, withAlpha } from '@/lib/utils';
import type { Contact, Tag, Conversation } from '@/types';
import { useRouter } from 'next/navigation';

interface ContactDetailDrawerProps {
  contact: Contact | null;
  onClose: () => void;
  onUpdated: (contact: Contact) => void;
}

const statusLabel: Record<string, string> = {
  OPEN: 'เปิด',
  PENDING: 'รอดำเนินการ',
  RESOLVED: 'แก้ไขแล้ว',
  SNOOZED: 'เลื่อน',
};

const statusColor: Record<string, string> = {
  OPEN: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-slate-100 text-slate-600',
  SNOOZED: 'bg-blue-100 text-blue-700',
};

export default function ContactDetailDrawer({ contact, onClose, onUpdated }: ContactDetailDrawerProps) {
  const router = useRouter();
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const tagPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contact) return;
    setEditName(contact.displayName);
    setEditPhone(contact.phone || '');
    setEditEmail(contact.email || '');
    setEditNotes(contact.notes || '');
    setConvLoading(true);
    api.get(`/api/contacts/${contact.id}`).then((res) => {
      setConversations(res.data.conversations || []);
    }).finally(() => setConvLoading(false));
    api.get('/api/tags').then((res) => {
      setAllTags(res.data.tags || res.data || []);
    });
  }, [contact?.id]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) {
        setTagPickerOpen(false);
      }
    };
    if (tagPickerOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [tagPickerOpen]);

  if (!contact) return null;

  const isDirty =
    editName !== contact.displayName ||
    editPhone !== (contact.phone || '') ||
    editEmail !== (contact.email || '') ||
    editNotes !== (contact.notes || '');

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.patch(`/api/contacts/${contact.id}`, {
        displayName: editName || undefined,
        phone: editPhone || undefined,
        email: editEmail || undefined,
        notes: editNotes || undefined,
      });
      onUpdated(res.data);
    } finally {
      setSaving(false);
    }
  };

  const handleResetName = async () => {
    setSaving(true);
    try {
      const res = await api.patch(`/api/contacts/${contact.id}`, { resetName: true });
      onUpdated(res.data);
      setEditName(res.data.displayName);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    await api.delete(`/api/contacts/${contact.id}/tags/${tagId}`);
    onUpdated({ ...contact, tags: contact.tags?.filter((t) => t.tagId !== tagId) });
  };

  const handleAddTag = async (tag: Tag) => {
    setTagPickerOpen(false);
    const alreadyHas = contact.tags?.some((t) => t.tagId === tag.id);
    if (alreadyHas) return;
    const res = await api.post(`/api/contacts/${contact.id}/tags`, { tagId: tag.id });
    onUpdated({
      ...contact,
      tags: [...(contact.tags || []), { contactId: contact.id, tagId: tag.id, tag: res.data.tag }],
    });
  };

  const existingTagIds = new Set(contact.tags?.map((t) => t.tagId));
  const availableTags = allTags.filter((t) => !existingTagIds.has(t.id));

  const initials = (contact.displayName || '?').slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-800">รายละเอียดผู้ติดต่อ</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Profile section */}
          <div className="flex flex-col items-center gap-2 bg-slate-50 px-5 py-6">
            {contact.avatarUrl ? (
              <img src={contact.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-white shadow" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-2xl font-bold text-white shadow">
                {initials}
              </div>
            )}
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-900">{contact.displayName}</p>
              {contact.isNameCustomized && contact.originalDisplayName && (
                <p className="text-xs text-slate-400">ชื่อจริง: {contact.originalDisplayName}</p>
              )}
            </div>
            <div className="flex gap-2">
              {contact.platformLinks?.map((pl) => (
                <PlatformIcon key={pl.id} platform={pl.platform} />
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">แท็ก</p>
            <div className="flex flex-wrap gap-1.5">
              {contact.tags?.map(({ tagId, tag }) => (
                <span
                  key={tagId}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: withAlpha(tag.color, 0.18),
                    color: tag.color,
                    border: `1px solid ${withAlpha(tag.color, 0.35)}`,
                  }}
                >
                  {tag.name}
                  <button
                    onClick={() => handleRemoveTag(tagId)}
                    className="ml-0.5 rounded-full hover:opacity-70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <div className="relative" ref={tagPickerRef}>
                <button
                  onClick={() => setTagPickerOpen((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-400 hover:border-slate-400 hover:text-slate-600"
                >
                  <Plus className="h-3 w-3" /> เพิ่มแท็ก
                </button>
                {tagPickerOpen && availableTags.length > 0 && (
                  <div className="absolute left-0 top-7 z-20 max-h-48 w-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {availableTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => handleAddTag(tag)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <span
                          className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </button>
                    ))}
                  </div>
                )}
                {tagPickerOpen && availableTags.length === 0 && (
                  <div className="absolute left-0 top-7 z-20 w-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-400 shadow-lg">
                    ไม่มีแท็กที่เหลือ
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Edit fields */}
          <div className="border-b border-slate-100 px-5 py-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">ข้อมูลติดต่อ</p>

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                ชื่อแสดง
                {contact.isNameCustomized && contact.originalDisplayName && (
                  <button
                    onClick={handleResetName}
                    title="คืนชื่อเดิม"
                    className="ml-auto text-[10px] text-slate-400 hover:text-orange-500 flex items-center gap-0.5"
                  >
                    <RotateCcw className="h-3 w-3" /> คืนชื่อจาก LINE
                  </button>
                )}
              </label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
              />
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Phone className="h-3.5 w-3.5" /> เบอร์โทร
              </label>
              <input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="ยังไม่มีข้อมูล"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
              />
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Mail className="h-3.5 w-3.5" /> อีเมล
              </label>
              <input
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="ยังไม่มีข้อมูล"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
              />
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <StickyNote className="h-3.5 w-3.5" /> โน้ต
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                placeholder="เพิ่มโน้ต..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 resize-none"
              />
            </div>

            {isDirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                บันทึกการเปลี่ยนแปลง
              </button>
            )}
          </div>

          {/* Conversation history */}
          <div className="px-5 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              ประวัติการสนทนา ({conversations.length})
            </p>
            {convLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-sm text-slate-400">ยังไม่มีการสนทนา</p>
            ) : (
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => { router.push(`/conversations/${conv.id}`); onClose(); }}
                    className="flex w-full items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50"
                  >
                    <MessageSquare className="h-4 w-4 flex-shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-700">
                        {conv.lastMessage || 'ไม่มีข้อความ'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {conv.lastMsgAt ? formatTimeAgo(conv.lastMsgAt) : '-'}
                      </p>
                    </div>
                    <span className={cn('flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', statusColor[conv.status])}>
                      {statusLabel[conv.status]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlatformIcon({ platform }: { platform: string }) {
  const icons: Record<string, React.ReactNode> = {
    LINE: <FaLine className="h-5 w-5 text-[#06C755]" />,
    FACEBOOK: <FaFacebook className="h-5 w-5 text-[#1877F2]" />,
    INSTAGRAM: <FaInstagram className="h-5 w-5 text-[#E4405F]" />,
    TIKTOK: <FaTiktok className="h-5 w-5 text-black" />,
  };
  return <span title={platform}>{icons[platform] ?? null}</span>;
}
