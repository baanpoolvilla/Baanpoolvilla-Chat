'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { getDefaultDashboardRoute } from '@/lib/permissions';
import type { LoginResponse } from '@/types';

/**
 * เปิดจาก SmartBoss (single sign-on) — SmartBoss ส่งมาที่ /sso#token=…
 * (อยู่หลัง # จึงไม่ไปโผล่ใน log ของเซิร์ฟเวอร์) แล้วหน้านี้ส่งต่อให้ API ตรวจ
 * ผูกบัญชีแล้ว/อีเมลตรงกัน → เข้าเลย · ยังไม่ผูก → ล็อกอินบัญชีแชทเดิมครั้งเดียวเพื่อผูก
 */
export default function SsoPage() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const started = useRef(false);
  const [state, setState] = useState<'checking' | 'link' | 'error'>('checking');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{ pendingToken: string; name: string; email: string } | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const enter = (data: LoginResponse) => {
    setSession(data);
    router.replace(getDefaultDashboardRoute(data.admin?.role));
  };

  const errorText = (err: unknown, fallback: string): string =>
    axios.isAxiosError(err) ? err.response?.data?.error || fallback : fallback;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
    // ลบ token ออกจากแถบที่อยู่ทันที — กันติดไปกับประวัติ/การแชร์ลิงก์
    window.history.replaceState(null, '', '/sso');
    if (!token) {
      setState('error');
      setError('ไม่พบข้อมูลจาก SmartBoss — กลับไปกดเปิดจาก SmartBoss อีกครั้ง');
      return;
    }
    api
      .post<LoginResponse>('/api/auth/sso', { token })
      .then((r) => enter(r.data))
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 409 && err.response.data?.needLink) {
          const d = err.response.data;
          setPending({ pendingToken: d.pendingToken, name: d.name, email: d.email });
          setEmail(d.email ?? '');
          setState('link');
          return;
        }
        setState('error');
        setError(errorText(err, 'เข้าสู่ระบบไม่สำเร็จ'));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!pending) return;
    setError('');
    setLoading(true);
    try {
      const r = await api.post<LoginResponse>('/api/auth/sso/link', { pendingToken: pending.pendingToken, email, password });
      enter(r.data);
    } catch (err) {
      setError(errorText(err, 'ผูกบัญชีไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 h-16 w-16 overflow-hidden rounded-2xl ring-1 ring-slate-200">
            <img src="/logo.png" alt="Baanpool-Chat" className="h-16 w-16 object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Baanpool-Chat</h1>
          <p className="text-sm text-gray-500 mt-1">เข้าใช้งานจาก SmartBoss</p>
        </div>

        {state === 'checking' && <p className="text-center text-sm text-gray-500">กำลังเข้าสู่ระบบ…</p>}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {state === 'link' && pending && (
          <form onSubmit={handleLink} className="space-y-4">
            <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-gray-800">
              <strong>{pending.name}</strong>
              {pending.email ? ` · ${pending.email}` : ''}
            </div>
            <p className="text-sm text-gray-600">
              ครั้งแรก: ล็อกอินบัญชีแชทเดิมของคุณหนึ่งครั้งเพื่อผูกกับ SmartBoss ครั้งต่อไปกดจาก SmartBoss เข้าได้เลย
              (ถ้ายังไม่มีบัญชีแชท ให้ผู้ดูแลระบบสร้างให้ก่อน)
            </p>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">อีเมลบัญชีแชท</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {loading ? 'กำลังผูกบัญชี…' : 'ผูกบัญชีและเข้าสู่ระบบ'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
