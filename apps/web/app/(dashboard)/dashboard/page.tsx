'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, Megaphone, MessageSquare, Tags } from 'lucide-react';
import api from '@/lib/api';
import type { Conversation } from '@/types';

type SummaryState = {
  totalConversations: number;
  openConversations: number;
  pendingConversations: number;
  totalTags: number;
};

const initialSummary: SummaryState = {
  totalConversations: 0,
  openConversations: 0,
  pendingConversations: 0,
  totalTags: 0,
};

export default function DashboardOverviewPage() {
  const [summary, setSummary] = useState<SummaryState>(initialSummary);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const [conversationRes, tagRes] = await Promise.all([
          api.get('/api/conversations', { params: { page: 1, limit: 200 } }),
          api.get('/api/tags'),
        ]);

        const conversations = (conversationRes.data.conversations || []) as Conversation[];
        const totalConversations = Number(conversationRes.data.pagination?.total || conversations.length || 0);
        const openConversations = conversations.filter((c) => c.status === 'OPEN').length;
        const pendingConversations = conversations.filter((c) => c.status === 'PENDING').length;

        const tagData = Array.isArray(tagRes.data) ? tagRes.data : (tagRes.data.data || []);

        setSummary({
          totalConversations,
          openConversations,
          pendingConversations,
          totalTags: tagData.length,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  const cards = useMemo(
    () => [
      {
        label: 'สนทนาทั้งหมด',
        value: summary.totalConversations,
        icon: MessageSquare,
        color: 'text-blue-600 bg-blue-50 border-blue-100',
      },
      {
        label: 'กำลังเปิดเคส',
        value: summary.openConversations,
        icon: Activity,
        color: 'text-orange-600 bg-orange-50 border-orange-100',
      },
      {
        label: 'รอติดตาม',
        value: summary.pendingConversations,
        icon: Megaphone,
        color: 'text-amber-600 bg-amber-50 border-amber-100',
      },
      {
        label: 'แท็กทั้งหมด',
        value: summary.totalTags,
        icon: Tags,
        color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
      },
    ],
    [summary]
  );

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Dashboard รวม</h1>
        <p className="text-sm text-gray-500">ภาพรวมสถานะงานและทางลัดสำหรับทีมแอดมิน</p>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-brand-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div className={`inline-flex rounded-lg border px-2 py-1 text-xs font-semibold ${card.color}`}>
                      {card.label}
                    </div>
                    <Icon className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">ทางลัด</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Link href="/conversations" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:border-brand-300 hover:bg-brand-50">
                ไปหน้าสนทนา
              </Link>
              <Link href="/tags" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:border-brand-300 hover:bg-brand-50">
                จัดการแท็ก
              </Link>
              <Link href="/broadcast" className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:border-brand-300 hover:bg-brand-50">
                ส่งประกาศ
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
