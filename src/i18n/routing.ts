import { createNavigation } from 'next-intl/navigation';
import { defaultLocale, locales, localePrefix } from './config';

export const { Link, permanentRedirect, redirect, usePathname, useRouter } = createNavigation({
  locales,
  localePrefix,
  defaultLocale
});
