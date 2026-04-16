import type { Metadata } from 'next';
import { Sarabun } from 'next/font/google';
import './globals.css';

const sarabun = Sarabun({
  subsets: ['latin', 'thai'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Unified Chat Management',
  description: 'Multi-platform chat management system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sarabun.className} min-h-screen bg-gray-50 antialiased`}>{children}</body>
    </html>
  );
}
