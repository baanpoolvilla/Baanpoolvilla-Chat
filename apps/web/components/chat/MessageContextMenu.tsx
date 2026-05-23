'use client';

import { useEffect, useRef } from 'react';
import { Reply, Pin, PinOff, Copy, Check } from 'lucide-react';
import type { Message } from '@/types';

interface MessageContextMenuProps {
  x: number;
  y: number;
  message: Message;
  canReply?: boolean;
  canPin?: boolean;
  onReply: () => void;
  onPin: () => void;
  onCopy: () => void;
  onClose: () => void;
}

export default function MessageContextMenu({
  x,
  y,
  message,
  canReply = true,
  canPin = true,
  onReply,
  onPin,
  onCopy,
  onClose,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // ปรับตำแหน่งไม่ให้เกินขอบจอ
  const adjustedX = Math.min(x, window.innerWidth - 180);
  const adjustedY = Math.min(y, window.innerHeight - 160);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // ใช้ทั้ง mousedown และ touchstart เพื่อรองรับ mobile
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const isText = message.contentType === 'TEXT';

  const items = [
    canReply && {
      icon: <Reply className="h-4 w-4" />,
      label: 'ตอบกลับ',
      onClick: () => { onReply(); onClose(); },
    },
    isText && {
      icon: <Copy className="h-4 w-4" />,
      label: 'คัดลอกข้อความ',
      onClick: () => { onCopy(); onClose(); },
    },
    canPin && {
      icon: message.isPinned
        ? <PinOff className="h-4 w-4" />
        : <Pin className="h-4 w-4" />,
      label: message.isPinned ? 'เอาหมุดออก' : 'ปักหมุด',
      onClick: () => { onPin(); onClose(); },
      highlight: !message.isPinned,
    },
  ].filter(Boolean) as {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    highlight?: boolean;
  }[];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-xl border border-gray-100 bg-white py-1 shadow-xl"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={item.onClick}
          className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 ${
            item.highlight ? 'text-brand-600 font-medium' : 'text-gray-700'
          }`}
        >
          <span className={item.highlight ? 'text-brand-500' : 'text-gray-400'}>
            {item.icon}
          </span>
          {item.label}
        </button>
      ))}
    </div>
  );
}
