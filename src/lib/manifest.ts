import { getTranslations } from 'next-intl/server';
import { defaultLocale, type Locale } from '@/i18n/config';
import { localizedPath } from '@/i18n/paths';
import { SITE_THEME_COLOR } from './site';

const LOCALE_DIRECTION: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  pt: 'ltr',
  es: 'ltr'
};

const SHORTCUTS: Array<{ key: 'search' | 'venues' | 'lists'; path: string }> = [
  { key: 'search', path: '/search' },
  { key: 'venues', path: '/venues' },
  { key: 'lists', path: '/lists' }
];

export async function buildWebManifest(locale: Locale) {
  const t = await getTranslations({ locale, namespace: 'manifest' });
  const start = localizedPath(locale, '/');
  return {
    id: '/?source=pwa',
    name: t('name'),
    short_name: t('shortName'),
    description: t('description'),
    lang: locale,
    dir: LOCALE_DIRECTION[locale] || LOCALE_DIRECTION[defaultLocale],
    start_url: `${start}${start.includes('?') ? '&' : '?'}source=pwa`,
    scope: '/',
    categories: ['reference', 'education', 'books'],
    display: 'standalone',
    display_override: ['window-controls-overlay', 'minimal-ui'],
    orientation: 'any',
    theme_color: SITE_THEME_COLOR,
    background_color: SITE_THEME_COLOR,
    icons: [
      { src: '/favicon-16x16.png', sizes: '16x16', type: 'image/png', purpose: 'any' },
      { src: '/favicon-32x32.png', sizes: '32x32', type: 'image/png', purpose: 'any' },
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' }
    ],
    screenshots: [
      {
        src: '/screenshots/desktop-library.png',
        sizes: '2560x1285',
        type: 'image/png',
        form_factor: 'wide',
        label: t('screenshots.desktop')
      },
      {
        src: '/screenshots/mobile-search.png',
        sizes: '500x874',
        type: 'image/png',
        form_factor: 'narrow',
        label: t('screenshots.mobile')
      }
    ],
    shortcuts: SHORTCUTS.map((shortcut) => ({
      name: t(`shortcuts.${shortcut.key}.name`),
      short_name: t(`shortcuts.${shortcut.key}.shortName`),
      description: t(`shortcuts.${shortcut.key}.description`),
      url: localizedPath(locale, shortcut.path),
      icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' }]
    }))
  };
}

export function manifestResponse(manifest: unknown) {
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400'
    }
  });
}
