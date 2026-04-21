'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Plus, Pencil, Trash2, Check } from 'lucide-react';
import api from '@/lib/api';
import type { QuickReply } from '@/types';

interface QuickReplyPickerProps {
  onSelect: (content: string) => void;
  onClose: () => void;
}

export default function QuickReplyPicker({ onSelect, onClose }: QuickReplyPickerProps) {
  const [items, setItems] = useState<QuickReply[]>([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleAdd = async () => {
    if (!newTitle.trim() || !newContent.trim() || saving) return;
    setSaving(true);
    try {
      const res = await api.post('/api/quick-replies', {
        title: newTitle.trim(),
        content: newContent.trim(),
      });
      setItems((prev) => [...prev, res.data.data]);
      setNewTitle('');
      setNewContent('');
      setIsAdding(false);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: QuickReply) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editTitle.trim() || !editContent.trim() || saving) return;
    setSaving(true);
    try {
      const res = await api.put(`/api/quick-replies/${id}`, {
        title: editTitle.trim(),
        content: editContent.trim(),
      });
      setItems((prev) => prev.map((r) => (r.id === id ? res.data.data : r)));
      setEditingId(null);
    } catch {
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
      className="absolute bottom-full left-0 z-50 mb-2 w-96 rounded-xl border border-gray-200 bg-white shadow-xl"
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
            placeholder="เนื้อหาข้อความ"
            rows={3}
            className="mb-2 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setIsAdding(false);
                setNewTitle('');
                setNewContent('');
              }}
              className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleAdd}
              disabled={!newTitle.trim() || !newContent.trim() || saving}
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
                    rows={3}
                    className="mb-2 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-200"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={() => handleSaveEdit(item.id)}
                      disabled={!editTitle.trim() || !editContent.trim() || saving}
                      className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" /> บันทึก
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="group flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-gray-50"
                  onClick={() => onSelect(item.content)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-brand-700">{item.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-gray-600">{item.content}</p>
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
