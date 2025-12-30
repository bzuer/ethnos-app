import type { ReactNode } from 'react';
import { cookies, headers } from 'next/headers';
import '@/styles/globals.css';
import { defaultLocale, locales, type Locale } from '@/i18n/config';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await resolveLocaleFromRequest();
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

async function resolveLocaleFromRequest(): Promise<Locale> {
  try {
    const headerList = await headers();
    const headerLocale = headerList?.get?.('x-next-intl-locale');
    if (headerLocale && locales.includes(headerLocale as Locale)) return headerLocale as Locale;
  } catch {}
  try {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore?.get?.('NEXT_LOCALE')?.value;
    if (cookieLocale && locales.includes(cookieLocale as Locale)) return cookieLocale as Locale;
  } catch {}
  return defaultLocale;
}
