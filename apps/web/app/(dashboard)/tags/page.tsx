'use client';

import { useState, useEffect, FormEvent, useRef } from 'react';
import api from '@/lib/api';
import type { Tag, TagCategory } from '@/types';
import { getTagTextColor, withAlpha } from '@/lib/utils';
import { Palette } from 'lucide-react';

interface CategoryWithTags extends TagCategory {
  tags: Tag[];
}

export default function TagsPage() {
  const [categories, setCategories] = useState<CategoryWithTags[]>([]);
  const [loading, setLoading] = useState(true);

  // Create category
  const [newCatName, setNewCatName] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);

  // Create tag
  const [newTagCatId, setNewTagCatId] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [newTagDesc, setNewTagDesc] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);

  // Edit tag
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDesc, setEditingDesc] = useState('');
  const [editingColor, setEditingColor] = useState('#6366f1');
  const [savingDesc, setSavingDesc] = useState(false);

  const fetchCategories = () => {
    setLoading(true);
    api
      .get('/api/tags/categories')
      .then((res) => setCategories(Array.isArray(res.data) ? res.data : (res.data.data || [])))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreateCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCreatingCat(true);
    try {
      await api.post('/api/tags/categories', { name: newCatName.trim() });
      setNewCatName('');
      fetchCategories();
    } finally {
      setCreatingCat(false);
    }
  };

  const handleCreateTag = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim() || !newTagCatId) return;
    setCreatingTag(true);
    try {
      await api.post('/api/tags', {
        name: newTagName.trim(),
        color: newTagColor,
        description: newTagDesc.trim() || undefined,
        categoryId: newTagCatId,
      });
      setNewTagName('');
      setNewTagDesc('');
      fetchCategories();
    } finally {
      setCreatingTag(false);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('ลบแท็กนี้?')) return;
    await api.delete(`/api/tags/${tagId}`);
    fetchCategories();
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm('ลบหมวดหมู่นี้? แท็กในหมวดหมู่จะถูกลบด้วย')) return;
    await api.delete(`/api/tags/categories/${catId}`);
    fetchCategories();
  };

  const startEditTag = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditingName(tag.name);
    setEditingDesc(tag.description ?? '');
    setEditingColor(tag.color);
  };

  const handleSaveTag = async (tag: Tag) => {
    if (!editingName.trim()) return;
    setSavingDesc(true);
    try {
      await api.put(`/api/tags/${tag.id}`, {
        name: editingName.trim(),
        color: editingColor,
        description: editingDesc.trim() || null,
        categoryId: tag.categoryId,
      });
      setEditingTagId(null);
      fetchCategories();
    } finally {
      setSavingDesc(false);
    }
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">จัดการแท็ก</h1>
        <p className="text-sm text-gray-500">สร้างและจัดการหมวดหมู่และแท็ก</p>
      </div>

      {/* Create Category */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">เพิ่มหมวดหมู่</h2>
        <form onSubmit={handleCreateCategory} className="flex gap-3">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="ชื่อหมวดหมู่"
            className="flex-1 max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
          <button
            type="submit"
            disabled={creatingCat}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            สร้าง
          </button>
        </form>
      </div>

      {/* Create Tag */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">เพิ่มแท็ก</h2>
        <form onSubmit={handleCreateTag} className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <select
              value={newTagCatId}
              onChange={(e) => setNewTagCatId(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            >
              <option value="">เลือกหมวดหมู่</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="ชื่อแท็ก"
              className="max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
            />
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={newTagDesc}
              onChange={(e) => setNewTagDesc(e.target.value)}
              placeholder="รายละเอียด (แสดงเมื่อชี้เมาส์)"
              maxLength={300}
              className="flex-1 max-w-sm px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm"
            />
            <button
              type="submit"
              disabled={creatingTag}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              สร้าง
            </button>
          </div>
        </form>
      </div>

      {/* Categories and Tags List */}
      {loading ? (
        <div className="flex items-center justify-center h-20">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-8 text-gray-500">ยังไม่มีหมวดหมู่</div>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => (
            <div key={category.id} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">{category.name}</h3>
                <button
                  onClick={() => handleDeleteCategory(category.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  ลบหมวดหมู่
                </button>
              </div>
              <div className="space-y-2">
                {category.tags.map((tag) => (
                  <div key={tag.id} className="flex items-start gap-3">
                    {/* Tag badge preview */}
                    <span
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm flex-shrink-0"
                      style={{
                        backgroundColor: tag.color,
                        color: getTagTextColor(tag.color),
                        border: `1px solid ${withAlpha(tag.color, 0.9)}`,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: withAlpha(getTagTextColor(tag.color), 0.85) }}
                      />
                      {tag.name}
                    </span>

                    {/* Tag inline edit */}
                    {editingTagId === tag.id ? (
                      <div className="flex flex-wrap items-center gap-2 flex-1">
                        <input
                          autoFocus
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          maxLength={50}
                          placeholder="ชื่อแท็ก"
                          className="w-28 px-3 py-1 text-sm border border-brand-400 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                        <label
                          className="relative flex items-center gap-1.5 cursor-pointer rounded-lg border-2 border-dashed border-gray-300 px-2.5 py-1 text-xs text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
                          title="เปลี่ยนสีแท็ก"
                        >
                          <span
                            className="h-4 w-4 rounded-full border border-white shadow-sm flex-shrink-0"
                            style={{ backgroundColor: editingColor }}
                          />
                          <Palette className="h-3.5 w-3.5" />
                          <span>เปลี่ยนสี</span>
                          <input
                            type="color"
                            value={editingColor}
                            onChange={(e) => setEditingColor(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                        </label>
                        <input
                          type="text"
                          value={editingDesc}
                          onChange={(e) => setEditingDesc(e.target.value)}
                          maxLength={300}
                          placeholder="รายละเอียด (แสดงเมื่อชี้เมาส์)"
                          className="flex-1 min-w-[120px] px-3 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                        <button
                          onClick={() => handleSaveTag(tag)}
                          disabled={savingDesc}
                          className="px-3 py-1 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                        >
                          บันทึก
                        </button>
                        <button
                          onClick={() => setEditingTagId(null)}
                          className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span
                          className="text-sm text-gray-500 truncate cursor-pointer hover:text-brand-600"
                          onClick={() => startEditTag(tag)}
                          title="คลิกเพื่อแก้ไข"
                        >
                          {tag.description || (
                            <span className="italic text-gray-300">+ เพิ่มรายละเอียด / แก้ไขชื่อ</span>
                          )}
                        </span>
                        <button
                          onClick={() => handleDeleteTag(tag.id)}
                          className="ml-auto flex-shrink-0 text-xs text-red-400 hover:text-red-600"
                        >
                          ลบ
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {category.tags.length === 0 && (
                  <p className="text-sm text-gray-400">ยังไม่มีแท็กในหมวดหมู่นี้</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
