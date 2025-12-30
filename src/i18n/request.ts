import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, locales, type Locale } from './config';

function resolveLocale(locale?: string): Locale {
  if (locale && locales.includes(locale as Locale)) return locale as Locale;
  return defaultLocale;
}

export default getRequestConfig(async ({ locale }) => {
  const safeLocale = resolveLocale(locale);
  const messages = (await import(`../../messages/${safeLocale}.json`)).default;
  return { locale: safeLocale, messages };
});
