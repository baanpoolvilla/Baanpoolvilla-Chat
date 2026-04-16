'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface PlatformConfig {
  id: string;
  platform: string;
  channelId: string;
  channelSecret: string;
  accessToken: string;
  isActive: boolean;
  metadata: Record<string, unknown> | null;
}

const platformLabels: Record<string, string> = {
  LINE: 'LINE Official Account',
  FACEBOOK: 'Facebook Page',
  INSTAGRAM: 'Instagram Business',
  TIKTOK: 'TikTok Business',
};

const platformFields: Record<string, { key: string; label: string; placeholder: string }[]> = {
  LINE: [
    { key: 'channelId', label: 'Channel ID', placeholder: 'LINE Channel ID' },
    { key: 'channelSecret', label: 'Channel Secret', placeholder: 'LINE Channel Secret' },
    { key: 'accessToken', label: 'Channel Access Token', placeholder: 'LINE Channel Access Token' },
  ],
  FACEBOOK: [
    { key: 'channelId', label: 'Page ID', placeholder: 'Facebook Page ID' },
    { key: 'channelSecret', label: 'App Secret', placeholder: 'Facebook App Secret' },
    { key: 'accessToken', label: 'Page Access Token', placeholder: 'Facebook Page Access Token' },
  ],
  INSTAGRAM: [
    { key: 'channelId', label: 'Instagram Business Account ID', placeholder: 'Instagram Account ID' },
    { key: 'channelSecret', label: 'App Secret', placeholder: 'Meta App Secret' },
    { key: 'accessToken', label: 'Page Access Token', placeholder: 'Instagram Page Access Token' },
  ],
  TIKTOK: [
    { key: 'channelId', label: 'TikTok Business ID', placeholder: 'TikTok Business Account ID' },
    { key: 'channelSecret', label: 'Client Secret', placeholder: 'TikTok Client Secret' },
    { key: 'accessToken', label: 'Access Token', placeholder: 'TikTok Access Token' },
  ],
};

export default function IntegrationsPage() {
  const [configs, setConfigs] = useState<PlatformConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api
      .get('/api/settings/platforms')
      .then((res) => {
        const data: PlatformConfig[] = res.data.data || [];
        setConfigs(data);
        const fd: Record<string, Record<string, string>> = {};
        data.forEach((c) => {
          fd[c.platform] = {
            channelId: c.channelId || '',
            channelSecret: c.channelSecret || '',
            accessToken: c.accessToken || '',
          };
        });
        // Ensure all platforms have form data
        ['LINE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK'].forEach((p) => {
          if (!fd[p]) {
            fd[p] = { channelId: '', channelSecret: '', accessToken: '' };
          }
        });
        setFormData(fd);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (platform: string) => {
    setSaving(platform);
    setMessage(null);
    try {
      const existing = configs.find((c) => c.platform === platform);
      const payload = { platform, ...formData[platform], isActive: true };
      if (existing) {
        await api.put(`/api/settings/platforms/${existing.id}`, payload);
      } else {
        await api.post('/api/settings/platforms', payload);
      }
      setMessage({ type: 'success', text: `บันทึก ${platformLabels[platform]} สำเร็จ` });
    } catch {
      setMessage({ type: 'error', text: `เกิดข้อผิดพลาดในการบันทึก ${platformLabels[platform]}` });
    } finally {
      setSaving(null);
    }
  };

  const updateField = (platform: string, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">เชื่อมต่อแพลตฟอร์ม</h1>
        <p className="text-sm text-gray-500">ตั้งค่า API keys สำหรับแต่ละแพลตฟอร์ม</p>
      </div>

      {message && (
        <div className={`rounded-lg p-3 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      {['LINE', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK'].map((platform) => (
        <div key={platform} className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {platformLabels[platform]}
            </h2>
            {configs.find((c) => c.platform === platform)?.isActive && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                เชื่อมต่อแล้ว
              </span>
            )}
          </div>

          <div className="space-y-3">
            {platformFields[platform].map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                </label>
                <input
                  type="password"
                  value={formData[platform]?.[field.key] || ''}
                  onChange={(e) => updateField(platform, field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  autoComplete="off"
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => handleSave(platform)}
              disabled={saving === platform}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {saving === platform ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
