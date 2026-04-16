'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import type { Tag, TagCategory } from '@/types';

interface TargetSelectorProps {
  target: 'ALL' | 'BY_TAG' | 'BY_PLATFORM';
  onTargetChange: (target: 'ALL' | 'BY_TAG' | 'BY_PLATFORM') => void;
  selectedTagIds: string[];
  onTagIdsChange: (ids: string[]) => void;
  selectedPlatforms: string[];
  onPlatformsChange: (platforms: string[]) => void;
  estimatedCount?: number;
}

interface CategoryWithTags extends TagCategory {
  tags: Tag[];
}

const platforms = [
  { id: 'LINE', label: 'LINE', color: 'bg-green-500' },
  { id: 'FACEBOOK', label: 'Facebook', color: 'bg-blue-600' },
  { id: 'INSTAGRAM', label: 'Instagram', color: 'bg-pink-500' },
  { id: 'TIKTOK', label: 'TikTok', color: 'bg-gray-900' },
];

export default function TargetSelector({
  target,
  onTargetChange,
  selectedTagIds,
  onTagIdsChange,
  selectedPlatforms,
  onPlatformsChange,
  estimatedCount,
}: TargetSelectorProps) {
  const [categories, setCategories] = useState<CategoryWithTags[]>([]);

  useEffect(() => {
    api.get('/api/tags/categories').then((res) => {
      setCategories(res.data.data || []);
    });
  }, []);

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagIdsChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onTagIdsChange([...selectedTagIds, tagId]);
    }
  };

  const togglePlatform = (platformId: string) => {
    if (selectedPlatforms.includes(platformId)) {
      onPlatformsChange(selectedPlatforms.filter((id) => id !== platformId));
    } else {
      onPlatformsChange([...selectedPlatforms, platformId]);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          กลุ่มเป้าหมาย
        </label>
        <div className="flex gap-2">
          {[
            { value: 'ALL' as const, label: 'ทั้งหมด' },
            { value: 'BY_TAG' as const, label: 'ตามแท็ก' },
            { value: 'BY_PLATFORM' as const, label: 'ตามแพลตฟอร์ม' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onTargetChange(option.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                target === option.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {target === 'BY_TAG' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            เลือกแท็กที่ต้องการส่ง (ผู้ติดต่อจะต้องมีทุกแท็กที่เลือก)
          </p>
          {categories.map((category) => (
            <div key={category.id}>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                {category.name}
              </p>
              <div className="flex flex-wrap gap-2">
                {category.tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm transition-colors ${
                      selectedTagIds.includes(tag.id)
                        ? 'ring-2 ring-offset-1 ring-brand-500'
                        : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: tag.color + '20', color: tag.color }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-gray-400">ยังไม่มีแท็ก กรุณาสร้างแท็กก่อน</p>
          )}
        </div>
      )}

      {target === 'BY_PLATFORM' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">เลือกแพลตฟอร์มที่ต้องการส่ง</p>
          <div className="flex flex-wrap gap-2">
            {platforms.map((platform) => (
              <button
                key={platform.id}
                type="button"
                onClick={() => togglePlatform(platform.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedPlatforms.includes(platform.id)
                    ? `${platform.color} text-white shadow-md`
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {platform.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {estimatedCount !== undefined && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-700">
            จำนวนผู้รับโดยประมาณ:{' '}
            <span className="font-bold">{estimatedCount.toLocaleString()}</span> คน
          </p>
        </div>
      )}
    </div>
  );
}
