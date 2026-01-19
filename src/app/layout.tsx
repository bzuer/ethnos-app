import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import '@/styles/globals.css';
import { defaultLocale } from '@/i18n/config';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1
};

export default async function RootLayout({ children, params }: { children: ReactNode; params?: Promise<{ locale?: string }> }) {
  const resolved = params ? await params : {};
  const locale = resolved?.locale || defaultLocale;
  const cssPath = process.env.NODE_ENV === 'development' ? '/css/styles.css' : '/css/styles.min.css';
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href={cssPath} />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#F5F5F4" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
