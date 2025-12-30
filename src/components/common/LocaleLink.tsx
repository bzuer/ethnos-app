'use client';

import type { ComponentProps } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import type { Locale } from '@/i18n/config';

type Props = ComponentProps<typeof Link> & { localeOverride?: Locale };

export default function LocaleLink({ localeOverride, ...props }: Props) {
  const currentLocale = useLocale();
  const locale = (localeOverride || currentLocale) as Locale;
  return <Link {...props} locale={locale} />;
}
