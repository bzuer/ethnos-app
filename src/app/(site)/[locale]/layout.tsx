import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import JsonLd from '@/components/common/JsonLd';
import LocaleLink from '@/components/common/LocaleLink';
import LocaleSwitcher from '@/components/common/LocaleSwitcher';
import ScrollTools from '@/components/common/ScrollTools';
import { locales, type Locale } from '@/i18n/config';
import {
  INDEXABLE_ROBOTS,
  alternateOpenGraphLocales,
  buildLanguageAlternates,
  manifestPath,
  metadataBase,
  openGraphLocales,
  resolveLocale,
  siteIcons,
  siteOpenGraphImage,
  siteVerification
} from '@/i18n/metadata';
import { localizedPath } from '@/i18n/paths';
import {
  SITE_NAME,
  SITE_ORIGIN,
  SITE_PUBLISHER,
  SITE_THEME_COLOR,
  SITE_THEME_COLOR_DARK,
  localeUrl
} from '@/lib/site';
import { buildSiteGraph } from '@/lib/structured-data';

type NavLinks = {
  home: string;
  search: string;
  journals: string;
  lists: string;
};

type FooterStrings = {
  project: string;
  openSource: string;
  privacy: string;
  license: string;
  frontendVersion: string;
  apiDocs: string;
  apiSource: string;
  frontendSource: string;
  doi: string;
  tagline: string;
};

const toKeywordList = (value: string) => value.split(',').map((entry) => entry.trim()).filter(Boolean);

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: SITE_THEME_COLOR },
    { media: '(prefers-color-scheme: dark)', color: SITE_THEME_COLOR_DARK }
  ]
};

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await props.params;
  const safeLocale = resolveLocale(locale);
  const t = await getTranslations({ locale: safeLocale, namespace: 'metadata.site' });
  const canonical = localeUrl(safeLocale, '/');
  const title = t('title');
  const description = t('description');
  const image = siteOpenGraphImage();

  return {
    metadataBase,
    title: {
      template: t('titleTemplate'),
      default: title
    },
    description,
    abstract: t('abstract'),
    keywords: toKeywordList(t('keywords')),
    applicationName: SITE_NAME,
    category: 'reference',
    creator: SITE_PUBLISHER,
    publisher: SITE_PUBLISHER,
    authors: [{ name: SITE_PUBLISHER, url: SITE_ORIGIN }],
    referrer: 'strict-origin-when-cross-origin',
    robots: INDEXABLE_ROBOTS,
    icons: siteIcons,
    manifest: manifestPath(safeLocale),
    verification: siteVerification(),
    alternates: {
      canonical,
      languages: buildLanguageAlternates('/')
    },
    openGraph: {
      type: 'website',
      locale: openGraphLocales[safeLocale],
      alternateLocale: alternateOpenGraphLocales(safeLocale),
      url: canonical,
      title,
      description,
      siteName: SITE_NAME,
      images: [image]
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image.url]
    }
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  setRequestLocale(locale as Locale);
  const cssPath = process.env.NODE_ENV === 'development' ? '/css/styles.css' : '/css/styles.min.css';
  const messages = await getMessages();
  const t = await getTranslations({ locale, namespace: 'layout' });
  const navLinks: NavLinks = {
    home: t('nav.home'),
    search: t('nav.search'),
    journals: t('nav.journals'),
    lists: t('nav.lists')
  };
  const footerStrings: FooterStrings = {
    project: t('footer.project'),
    openSource: t('footer.openSource'),
    privacy: t('footer.privacy'),
    license: t('footer.license'),
    frontendVersion: t('footer.frontendVersion'),
    apiDocs: t('footer.apiDocs'),
    apiSource: t('footer.apiSource'),
    frontendSource: t('footer.frontendSource'),
    doi: t('footer.doi'),
    tagline: t('footer.tagline')
  };
  const searchPath = localizedPath(locale as Locale, '/search/results');
  const searchTarget = `${metadataBase.origin}${searchPath}?q={search_term_string}`;

  return (
    <html lang={locale} dir="ltr" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href={cssPath} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <JsonLd data={buildSiteGraph(locale as Locale, searchTarget)} />
          <a href="#main-content" className="skip-link">{t('skipLink')}</a>
          <div className="container">
            <Header
              navLabel={t('nav.ariaLabel')}
              navLinks={navLinks}
              listCounterLabel={t('nav.listCounterLabel')}
            />
            <main id="main-content" tabIndex={-1}>
              {children}
            </main>
            <Footer label={t('footerLabel')} strings={footerStrings} />
            <div className="floating-tools">
              <LocaleSwitcher />
              <ScrollTools />
            </div>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

function Header({ navLabel, navLinks, listCounterLabel }: { navLabel: string; navLinks: NavLinks; listCounterLabel: string }) {
  return (
    <header className="global-header" role="banner">
      <p className="title-primary">ETHNOS_APP</p>
      <nav className="main-navigation" role="navigation" aria-label={navLabel}>
        <LocaleLink className="nav-breadcrumb" href="/">{navLinks.home}</LocaleLink>
        <span className="breadcrumb-separator" aria-hidden="true"> • </span>
        <LocaleLink className="nav-breadcrumb" href="/search">{navLinks.search}</LocaleLink>
        <span className="breadcrumb-separator" aria-hidden="true"> • </span>
        <LocaleLink className="nav-breadcrumb" href="/venues">{navLinks.journals}</LocaleLink>
        <span className="breadcrumb-separator" aria-hidden="true"> • </span>
        <LocaleLink className="nav-breadcrumb" href="/lists" aria-describedby="reading-list-counter">
          {navLinks.lists} <span id="reading-list-counter" className="list-counter" aria-label={listCounterLabel}>0</span>
        </LocaleLink>
      </nav>
    </header>
  );
}

function Footer({ label, strings }: { label: string; strings: FooterStrings }) {
  return (
    <footer className="footer" aria-label={label}>
      <div className="footer-sources">
        <a href={SITE_ORIGIN} target="_blank" rel="noopener noreferrer">{strings.project}</a> • {strings.openSource} • <LocaleLink href="/license">{strings.license}</LocaleLink> • {strings.frontendVersion} • <LocaleLink href="/privacy">{strings.privacy}</LocaleLink> • {strings.apiDocs}: <a href="https://api.ethnos.app/docs" target="_blank" rel="noopener noreferrer">api.ethnos.app/docs</a> • {strings.apiSource}: <a href="https://github.com/bzuer/ethnos-app" target="_blank" rel="noopener noreferrer">GitHub</a> • {strings.doi}: 10.5281/zenodo.17049435 • {strings.frontendSource}: <a href="https://github.com/bzuer/ethnos-app" target="_blank" rel="noopener noreferrer">GitHub</a> • {strings.doi}: 10.5281/zenodo.17050053 • <a href="https://cruz.rio.br" target="_blank" rel="noopener noreferrer">cruz.rio.br</a> • {strings.tagline}
      </div>
    </footer>
  );
}
