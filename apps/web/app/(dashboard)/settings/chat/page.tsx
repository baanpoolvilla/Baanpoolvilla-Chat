'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, UserRound, Check } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { useSocket } from '@/hooks/useSocket';

export default function ChatSettingsPage() {
  const [newConversationBot, setNewConversationBot] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { on } = useSocket();

  useEffect(() => {
    api
      .get('/api/settings/chat')
      .then((res) => setNewConversationBot(Boolean(res.data?.data?.newConversationBot)))
      .catch(() => setMessage({ type: 'error', text: 'โหลดการตั้งค่าไม่สำเร็จ' }))
      .finally(() => setLoading(false));
  }, []);

  // แอดมินคนอื่นเปลี่ยนค่า → อัปเดตหน้านี้ด้วย
  useEffect(() => {
    return on('settings:chat', (settings) => {
      setNewConversationBot(Boolean(settings?.newConversationBot));
    });
  }, [on]);

  const save = useCallback(
    async (value: boolean) => {
      if (saving || value === newConversationBot) return;
      const previous = newConversationBot;
      setNewConversationBot(value);
      setSaving(true);
      setMessage(null);
      try {
        await api.put('/api/settings/chat', { newConversationBot: value });
        setMessage({
          type: 'success',
          text: value
            ? 'บันทึกแล้ว — แชทใหม่จะให้บอทตอบอัตโนมัติ'
            : 'บันทึกแล้ว — แชทใหม่จะรอแอดมินตอบเอง',
        });
      } catch {
        setNewConversationBot(previous);
        setMessage({ type: 'error', text: 'บันทึกไม่สำเร็จ กรุณาลองใหม่' });
      } finally {
        setSaving(false);
      }
    },
    [newConversationBot, saving],
  );

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-brand-600" />
      </div>
    );
  }

  const options = [
    {
      value: true,
      icon: Bot,
      title: 'ให้บอทตอบอัตโนมัติ',
      desc: 'ลูกค้าที่ทักเข้ามาใหม่จะได้รับคำตอบจากบอททันที แอดมินกดรับช่วงต่อทีหลังได้ตลอด',
    },
    {
      value: false,
      icon: UserRound,
      title: 'ให้แอดมินตอบเอง',
      desc: 'แชทใหม่จะเงียบไว้รอแอดมิน ต้องกดเปิดบอทเองทีละแชทถ้าอยากให้บอทช่วยตอบ',
    },
  ];

  return (
    <div className="h-full space-y-6 overflow-auto p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">ตั้งค่าแชท</h1>
        <p className="text-sm text-gray-500">กำหนดว่าลูกค้าที่ทักเข้ามาใหม่จะให้ใครเป็นคนตอบ</p>
      </div>

      {message && (
        <div
          className={cn(
            'rounded-lg border p-3 text-sm',
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700',
          )}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <div>
          <p className="font-medium text-gray-900">ผู้ตอบเริ่มต้นของแชทใหม่</p>
          <p className="text-sm text-gray-500">
            มีผลกับแชทที่ถูกสร้างใหม่หลังจากนี้เท่านั้น — แชทที่คุยอยู่แล้วยังคงสถานะเดิม และสลับ Bot/Admin
            รายแชทได้เหมือนเดิม
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((opt) => {
            const Icon = opt.icon;
            const active = newConversationBot === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => save(opt.value)}
                disabled={saving}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors disabled:opacity-60',
                  active
                    ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                    : 'border-gray-200 bg-white hover:bg-gray-50',
                )}
              >
                <div className="flex w-full items-center gap-2">
                  <Icon className={cn('h-5 w-5', active ? 'text-brand-600' : 'text-gray-400')} />
                  <span className={cn('font-medium', active ? 'text-brand-700' : 'text-gray-900')}>
                    {opt.title}
                  </span>
                  {active && <Check className="ml-auto h-4 w-4 text-brand-600" />}
                </div>
                <p className="text-sm text-gray-500">{opt.desc}</p>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-gray-400">
          {saving ? 'กำลังบันทึก...' : 'เปลี่ยนได้ตลอดเวลา ระบบบันทึกให้อัตโนมัติเมื่อเลือก'}
        </p>
      </div>
    </div>
  );
}
