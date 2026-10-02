import type { Metadata, Viewport } from 'next';
import { ClientProviders } from '@/components/providers/ClientProviders';
import './globals.css';

export const metadata: Metadata = {
  title: 'AgriIntel — Farm Decision Assistant',
  description:
    'A multilingual farm decision assistant that combines field health, weather, yield forecasts and market intelligence to help farmers understand when and where they may get a better selling opportunity.',
  keywords: ['agriculture', 'crop yield', 'market analytics', 'mandi prices', 'farming', 'soybean', 'Maharashtra'],
  authors: [{ name: 'AgriIntel Team' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#2d6a4f' },
    { media: '(prefers-color-scheme: dark)', color: '#1a3d2b' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}

