'use client';

import { useState, useEffect, FormEvent } from 'react';
import api from '@/lib/api';
import type { Tag, TagCategory } from '@/types';

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
  const [creatingTag, setCreatingTag] = useState(false);

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
        categoryId: newTagCatId,
      });
      setNewTagName('');
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
        <form onSubmit={handleCreateTag} className="flex flex-wrap gap-3">
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
          <button
            type="submit"
            disabled={creatingTag}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            สร้าง
          </button>
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
              <div className="flex flex-wrap gap-2">
                {category.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm group"
                    style={{ backgroundColor: tag.color + '20', color: tag.color }}
                  >
                    {tag.name}
                    <button
                      onClick={() => handleDeleteTag(tag.id)}
                      className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    >
                      ×
                    </button>
                  </span>
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
