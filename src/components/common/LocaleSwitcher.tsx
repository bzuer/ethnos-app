'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/routing';
import { locales, type Locale } from '@/i18n/config';
import { localizedPath } from '@/i18n/paths';

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function persistLocale(locale: Locale, href: string | null) {
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
  if (href) window.location.assign(href);
}

export default function LocaleSwitcher() {
  const t = useTranslations('layout.language');
  const currentLocale = useLocale() as Locale;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selectLocale = (locale: Locale) => {
    setOpen(false);
    const href = locale === currentLocale ? null : `${localizedPath(locale, pathname)}${window.location.search}`;
    persistLocale(locale, href);
  };

  return (
    <div className="locale-switcher" ref={rootRef}>
      {open ? (
        <div className="locale-switcher-menu" role="listbox" aria-label={t('select')}>
          {locales.map((locale) => (
            <button
              key={locale}
              type="button"
              role="option"
              aria-selected={locale === currentLocale}
              className="locale-switcher-option"
              title={t(locale)}
              onClick={() => selectLocale(locale)}
            >
              {locale.toUpperCase()}
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="locale-switcher-toggle"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('label')}: ${t(currentLocale)}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{currentLocale.toUpperCase()}</span>
      </button>
    </div>
  );
}
