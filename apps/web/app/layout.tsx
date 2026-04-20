import type { Metadata } from 'next';
import { Sarabun } from 'next/font/google';
import './globals.css';

const sarabun = Sarabun({
  subsets: ['latin', 'thai'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Baanpool-Chat Management',
  description: 'Baanpool-Chat multi-platform chat management system',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sarabun.className} min-h-screen bg-gray-50 antialiased`}>{children}</body>
    </html>
  );
}
