'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface AiBotConfig {
  id: string;
  provider: string;
  model: string;
  apiKey: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  handoffKeywords: string[];
}

export default function AiBotPage() {
  const [config, setConfig] = useState<AiBotConfig>({
    id: '',
    provider: 'OPENAI',
    model: 'gpt-4o-mini',
    apiKey: '',
    systemPrompt: 'คุณเป็นผู้ช่วยฝ่ายบริการลูกค้า ตอบคำถามอย่างสุภาพและเป็นมิตร หากไม่สามารถตอบได้ ให้แนะนำให้ลูกค้าพูดคุยกับเจ้าหน้าที่',
    temperature: 0.7,
    maxTokens: 1024,
    isActive: false,
    handoffKeywords: ['คุยกับเจ้าหน้าที่', 'talk to agent', 'human', 'พนักงาน'],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newKeyword, setNewKeyword] = useState('');

  useEffect(() => {
    api
      .get('/api/settings/ai-bot')
      .then((res) => {
        if (res.data.data) {
          setConfig(res.data.data);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      if (config.id) {
        await api.put(`/api/settings/ai-bot/${config.id}`, config);
      } else {
        const res = await api.post('/api/settings/ai-bot', config);
        setConfig((prev) => ({ ...prev, id: res.data.data.id }));
      }
      setMessage({ type: 'success', text: 'บันทึกการตั้งค่า AI Bot สำเร็จ' });
    } catch {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
    } finally {
      setSaving(false);
    }
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !config.handoffKeywords.includes(newKeyword.trim())) {
      setConfig((prev) => ({
        ...prev,
        handoffKeywords: [...prev.handoffKeywords, newKeyword.trim()],
      }));
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setConfig((prev) => ({
      ...prev,
      handoffKeywords: prev.handoffKeywords.filter((k) => k !== keyword),
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
        <h1 className="text-xl font-bold text-gray-900">ตั้งค่า AI Bot</h1>
        <p className="text-sm text-gray-500">กำหนดค่า AI สำหรับตอบข้อความอัตโนมัติ</p>
      </div>

      {message && (
        <div className={`rounded-lg p-3 ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {/* Active Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">เปิดใช้งาน AI Bot</p>
            <p className="text-sm text-gray-500">Bot จะตอบข้อความอัตโนมัติเมื่อเปิดใช้งาน</p>
          </div>
          <button
            type="button"
            onClick={() => setConfig((prev) => ({ ...prev, isActive: !prev.isActive }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.isActive ? 'bg-brand-600' : 'bg-gray-300'}`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${config.isActive ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>

        {/* Provider */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
          <select
            value={config.provider}
            onChange={(e) => setConfig((prev) => ({ ...prev, provider: e.target.value }))}
            className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          >
            <option value="OPENAI">OpenAI</option>
            <option value="ANTHROPIC">Anthropic (Claude)</option>
          </select>
        </div>

        {/* Model */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
          <input
            type="text"
            value={config.model}
            onChange={(e) => setConfig((prev) => ({ ...prev, model: e.target.value }))}
            placeholder="gpt-4o-mini"
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => setConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
            placeholder="sk-..."
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            autoComplete="off"
          />
        </div>

        {/* System Prompt */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
          <textarea
            value={config.systemPrompt}
            onChange={(e) => setConfig((prev) => ({ ...prev, systemPrompt: e.target.value }))}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
          />
        </div>

        {/* Temperature */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Temperature: {config.temperature}
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={config.temperature}
            onChange={(e) => setConfig((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))}
            className="w-full max-w-md"
          />
          <div className="flex justify-between max-w-md text-xs text-gray-400">
            <span>แม่นยำ (0)</span>
            <span>สร้างสรรค์ (2)</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Tokens</label>
          <input
            type="number"
            value={config.maxTokens}
            onChange={(e) => setConfig((prev) => ({ ...prev, maxTokens: parseInt(e.target.value) || 1024 }))}
            min={100}
            max={4096}
            className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
        </div>

        {/* Handoff Keywords */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            คำสำหรับส่งต่อเจ้าหน้าที่ (Handoff Keywords)
          </label>
          <p className="text-xs text-gray-400 mb-2">
            เมื่อลูกค้าพิมพ์คำเหล่านี้ Bot จะหยุดตอบและส่งต่อให้เจ้าหน้าที่
          </p>
          <div className="flex flex-wrap gap-2 mb-2">
            {config.handoffKeywords.map((kw) => (
              <span key={kw} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm">
                {kw}
                <button
                  type="button"
                  onClick={() => removeKeyword(kw)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
              placeholder="เพิ่มคำ..."
              className="max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
            <button
              type="button"
              onClick={addKeyword}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
            >
              เพิ่ม
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
        </button>
      </div>
    </div>
  );
}
