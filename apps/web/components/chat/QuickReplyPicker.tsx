'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { X, Plus, Pencil, Trash2, Check, ImagePlus, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import type { QuickReply } from '@/types';

interface QuickReplyPickerProps {
  onSelect: (content: string, mediaUrl?: string | null) => void;
  onClose: () => void;
  className?: string;
}

// Content placeholder for image-only templates — platform services treat it as "no caption".
const IMAGE_ONLY_CONTENT = '[Image]';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function ImageField({
  mediaUrl,
  isUploading,
  onPick,
  onRemove,
}: {
  mediaUrl: string | null;
  isUploading: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  if (mediaUrl) {
    return (
      <div className="mb-2 flex items-center gap-2">
        <div className="relative h-14 w-14">
          <img src={mediaUrl} alt="" className="h-full w-full rounded-lg border border-gray-200 object-cover" />
          <button
            type="button"
            onClick={onRemove}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700/80 text-white shadow"
            title="ลบรูป"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        <button
          type="button"
          onClick={onPick}
          disabled={isUploading}
          className="text-xs text-brand-600 hover:underline disabled:opacity-50"
        >
          เปลี่ยนรูป
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={isUploading}
      className="mb-2 flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:border-brand-400 hover:text-brand-600 disabled:opacity-50"
    >
      {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
      {isUploading ? 'กำลังอัปโหลด...' : 'แนบรูป'}
    </button>
  );
}

export default function QuickReplyPicker({ onSelect, onClose, className }: QuickReplyPickerProps) {
  const [items, setItems] = useState<QuickReply[]>([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editMediaUrl, setEditMediaUrl] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newMediaUrl, setNewMediaUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<'new' | 'edit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const newFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const fetchItems = async () => {
    try {
      const res = await api.get('/api/quick-replies');
      setItems(res.data.data || []);
    } catch {}
  };

  const filtered = items.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.content.toLowerCase().includes(search.toLowerCase()),
  );

  // Uploads immediately so the template stores a permanent URL, not a blob.
  const handlePickImage = async (e: ChangeEvent<HTMLInputElement>, target: 'new' | 'edit') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('แนบได้เฉพาะไฟล์รูปภาพ');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('รูปใหญ่เกิน 10 MB');
      return;
    }

    setUploadingFor(target);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
        reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
        reader.readAsDataURL(file);
      });
      const res = await api.post('/api/media/upload', { data: base64, mimeType: file.type });
      const url = res.data?.data?.url;
      if (!url) throw new Error('เซิร์ฟเวอร์ไม่ได้ส่ง URL กลับมา');

      if (target === 'new') setNewMediaUrl(url);
      else setEditMediaUrl(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? `อัปโหลดรูปไม่สำเร็จ: ${err.message}` : 'อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setUploadingFor(null);
    }
  };

  const resetAddForm = () => {
    setIsAdding(false);
    setNewTitle('');
    setNewContent('');
    setNewMediaUrl(null);
    setError(null);
  };

  const handleAdd = async () => {
    if (!newTitle.trim() || (!newContent.trim() && !newMediaUrl) || saving) return;
    setSaving(true);
    try {
      const res = await api.post('/api/quick-replies', {
        title: newTitle.trim(),
        content: newContent.trim() || IMAGE_ONLY_CONTENT,
        mediaUrl: newMediaUrl,
      });
      setItems((prev) => [...prev, res.data.data]);
      resetAddForm();
    } catch {
      setError('บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: QuickReply) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content === IMAGE_ONLY_CONTENT ? '' : item.content);
    setEditMediaUrl(item.mediaUrl ?? null);
    setError(null);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editTitle.trim() || (!editContent.trim() && !editMediaUrl) || saving) return;
    setSaving(true);
    try {
      const res = await api.put(`/api/quick-replies/${id}`, {
        title: editTitle.trim(),
        content: editContent.trim() || IMAGE_ONLY_CONTENT,
        mediaUrl: editMediaUrl,
      });
      setItems((prev) => prev.map((r) => (r.id === id ? res.data.data : r)));
      setEditingId(null);
      setEditMediaUrl(null);
    } catch {
      setError('บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/quick-replies/${id}`);
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch {}
  };

  return (
    <div
      ref={containerRef}
      className={className ?? "absolute bottom-full left-0 z-50 mb-2 w-[calc(100vw-1.5rem)] max-w-96 rounded-xl border border-gray-200 bg-white shadow-xl sm:w-96"}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <span className="text-sm font-semibold text-gray-800">Quick Replies</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsAdding(true);
              setEditingId(null);
            }}
            className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-100"
          >
            <Plus className="h-3.5 w-3.5" />
            เพิ่ม
          </button>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-gray-100 px-4 py-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาข้อความ..."
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
          autoFocus
        />
      </div>

      {/* Add form */}
      {isAdding && (
        <div className="border-b border-gray-100 bg-brand-50 px-4 py-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="ชื่อข้อความสำเร็จรูป"
            className="mb-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder={newMediaUrl ? 'ข้อความประกอบรูป (ไม่ใส่ก็ได้)' : 'เนื้อหาข้อความ'}
            rows={3}
            className="mb-2 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
          />

          <ImageField
            mediaUrl={newMediaUrl}
            isUploading={uploadingFor === 'new'}
            onPick={() => newFileInputRef.current?.click()}
            onRemove={() => setNewMediaUrl(null)}
          />
          <input
            ref={newFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePickImage(e, 'new')}
          />

          {error && <p className="mb-2 text-xs font-medium text-red-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              onClick={resetAddForm}
              className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleAdd}
              disabled={!newTitle.trim() || (!newContent.trim() && !newMediaUrl) || saving || uploadingFor !== null}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              บันทึก
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="max-h-72 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-400">
            {items.length === 0 ? 'ยังไม่มีข้อความสำเร็จรูป' : 'ไม่พบข้อความที่ค้นหา'}
          </p>
        ) : (
          filtered.map((item) => (
            <div key={item.id} className="border-b border-gray-50 last:border-0">
              {editingId === item.id ? (
                <div className="bg-gray-50 px-4 py-3">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="mb-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder={editMediaUrl ? 'ข้อความประกอบรูป (ไม่ใส่ก็ได้)' : 'เนื้อหาข้อความ'}
                    rows={3}
                    className="mb-2 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
                  />

                  <ImageField
                    mediaUrl={editMediaUrl}
                    isUploading={uploadingFor === 'edit'}
                    onPick={() => editFileInputRef.current?.click()}
                    onRemove={() => setEditMediaUrl(null)}
                  />
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePickImage(e, 'edit')}
                  />

                  {error && <p className="mb-2 text-xs font-medium text-red-500">{error}</p>}

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-200"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={() => handleSaveEdit(item.id)}
                      disabled={!editTitle.trim() || (!editContent.trim() && !editMediaUrl) || saving || uploadingFor !== null}
                      className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" /> บันทึก
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="group flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-gray-50"
                  onClick={() => onSelect(item.content, item.mediaUrl)}
                >
                  {item.mediaUrl && (
                    <img
                      src={item.mediaUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-brand-700">{item.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-gray-600">
                      {item.content === IMAGE_ONLY_CONTENT ? 'รูปภาพ' : item.content}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(item);
                      }}
                      className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
