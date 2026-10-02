import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'ذِكر', description: 'تذكير خاص بين جهازين',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'ذِكر', statusBarStyle: 'default' },
  icons: { icon: '/favicon.svg', apple: '/icons/icon-192.png' },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f3f5f6' },
               { media: '(prefers-color-scheme: dark)', color: '#11181d' }],
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
