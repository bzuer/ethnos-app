export const locales = ['en', 'pt', 'es'] as const;
export const defaultLocale = 'en';
export const localePrefix = 'as-needed';
export type Locale = (typeof locales)[number];
