'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import type { Tag, TagCategory } from '@/types';
import TagBadge from './TagBadge';
import { Tag as TagIcon, ChevronDown } from 'lucide-react';

interface TagSelectorProps {
  selectedTagIds: string[];
  onAdd: (tagId: string) => void;
  onRemove: (tagId: string) => void;
}

export default function TagSelector({ selectedTagIds, onAdd, onRemove }: TagSelectorProps) {
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const [catRes, tagRes] = await Promise.all([
          api.get<TagCategory[]>('/tags/categories'),
          api.get<Tag[]>('/tags'),
        ]);
        setCategories(catRes.data);
        setAllTags(tagRes.data);
      } catch (error) {
        console.error('Failed to fetch tags:', error);
      }
    };
    fetchTags();
  }, []);

  const selectedTags = allTags.filter((t) => selectedTagIds.includes(t.id));
  const availableTags = allTags.filter((t) => !selectedTagIds.includes(t.id));

  const groupedTags = categories.map((cat) => ({
    ...cat,
    tags: availableTags.filter((t) => t.categoryId === cat.id),
  }));

  const uncategorized = availableTags.filter((t) => !t.categoryId);

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 mb-2">
        {selectedTags.map((tag) => (
          <TagBadge
            key={tag.id}
            name={tag.name}
            color={tag.color}
            onRemove={() => onRemove(tag.id)}
          />
        ))}
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
      >
        <TagIcon className="h-4 w-4" />
        Add Tag
        <ChevronDown className="h-3 w-3" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="max-h-64 overflow-y-auto p-2">
            {groupedTags.map((cat) =>
              cat.tags.length > 0 ? (
                <div key={cat.id} className="mb-2">
                  <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase">
                    {cat.name}
                  </div>
                  {cat.tags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => {
                        onAdd(tag.id);
                        setIsOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-100"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </button>
                  ))}
                </div>
              ) : null
            )}
            {uncategorized.length > 0 && (
              <div className="mb-2">
                <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase">
                  Other
                </div>
                {uncategorized.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      onAdd(tag.id);
                      setIsOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-100"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
            {availableTags.length === 0 && (
              <p className="px-2 py-3 text-center text-sm text-gray-400">No more tags available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
