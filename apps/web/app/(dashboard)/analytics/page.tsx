'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface Stats {
  totalConversations: number;
  activeConversations: number;
  totalContacts: number;
  totalMessages: number;
  platformBreakdown: { platform: string; count: number }[];
  recentActivity: { date: string; messages: number }[];
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Aggregate stats from multiple endpoints
    Promise.all([
      api.get('/api/conversations', { params: { limit: 1 } }),
      api.get('/api/contacts', { params: { limit: 1 } }),
    ])
      .then(([convRes, contactRes]) => {
        setStats({
          totalConversations: convRes.data.meta?.total || 0,
          activeConversations: 0,
          totalContacts: contactRes.data.meta?.total || 0,
          totalMessages: 0,
          platformBreakdown: [],
          recentActivity: [],
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    {
      label: 'สนทนาทั้งหมด',
      value: stats?.totalConversations || 0,
      icon: '💬',
      color: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'ผู้ติดต่อทั้งหมด',
      value: stats?.totalContacts || 0,
      icon: '👥',
      color: 'bg-green-50 text-green-700',
    },
    {
      label: 'กำลังดำเนินการ',
      value: stats?.activeConversations || 0,
      icon: '⚡',
      color: 'bg-yellow-50 text-yellow-700',
    },
    {
      label: 'ข้อความทั้งหมด',
      value: stats?.totalMessages || 0,
      icon: '📨',
      color: 'bg-purple-50 text-purple-700',
    },
  ];

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">สถิติ</h1>
        <p className="text-sm text-gray-500">ภาพรวมระบบจัดการแชท</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="bg-white rounded-xl border border-gray-200 p-6"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{card.icon}</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${card.color}`}
                  >
                    {card.label}
                  </span>
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {card.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              หมายเหตุ
            </h2>
            <p className="text-sm text-gray-500">
              สถิติขั้นสูง เช่น กราฟข้อความรายวัน, การกระจายตัวตามแพลตฟอร์ม,
              เวลาตอบกลับเฉลี่ย สามารถเพิ่มเติมได้โดยการสร้าง API endpoint
              สำหรับ analytics โดยเฉพาะ ดูรายละเอียดใน README
            </p>
          </div>
        </>
      )}
    </div>
  );
}
