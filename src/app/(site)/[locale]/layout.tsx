import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import LocaleLink from '@/components/common/LocaleLink';
import LocaleSwitcher from '@/components/common/LocaleSwitcher';
import ScrollTools from '@/components/common/ScrollTools';
import { locales, type Locale } from '@/i18n/config';
import { buildLanguageAlternates, metadataBase, openGraphLocales } from '@/i18n/metadata';
import { localizedPath } from '@/i18n/paths';

type NavLinks = {
  home: string;
  search: string;
  journals: string;
  institutions: string;
  subjects: string;
  explore: string;
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

const siteDescription = 'Ethnos delivers an open bibliography for anthropology and sociology, joining works, journals, metrics, and research tools in a single catalog.';
const siteAbstract = 'Ethnos Bibliography is a reference discovery environment dedicated to anthropology, sociology, and ethnographic studies.';
const siteKeywords = [
  'anthropology bibliography tool',
  'sociology research index',
  'ethnography reference platform',
  'open bibliographic database',
  'latin american social sciences catalog',
  'journals directory anthropology',
  'research metrics export'
];
const socialImage = new URL('/og-default.png', metadataBase).toString();

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1
};

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await props.params;
  const safeLocale = locale as Locale;
  const ogLocale = openGraphLocales[safeLocale] || openGraphLocales.en;
  const alternateLocale = locales.filter((code) => code !== safeLocale).map((code) => openGraphLocales[code as Locale]);
  const canonicalPath = localizedPath(safeLocale, '/');
  const canonical = new URL(canonicalPath, metadataBase).toString();

  return {
    metadataBase,
    title: {
      template: '%s | Ethnos Bibliography',
      default: 'Ethnos Bibliography | Anthropology & Sociology Research Tool'
    },
    description: siteDescription,
    abstract: siteAbstract,
    keywords: siteKeywords,
    applicationName: 'Ethnos Bibliography',
    category: 'reference',
    creator: 'Ethnos Research Lab',
    publisher: 'Ethnos Research Lab',
    authors: [{ name: 'Ethnos Research Lab' }],
    robots: {
      index: true,
      follow: true
    },
    alternates: {
      canonical,
      languages: buildLanguageAlternates('/')
    },
    openGraph: {
      type: 'website',
      locale: ogLocale,
      alternateLocale,
      url: canonical,
      title: 'Ethnos Bibliography | Anthropology & Sociology Research Tool',
      description: siteDescription,
      siteName: 'Ethnos Bibliography',
      images: [
        {
          url: socialImage,
          width: 1200,
          height: 630,
          alt: 'Ethnos Bibliography catalog interface'
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Ethnos Bibliography | Anthropology & Sociology Research Tool',
      description: siteDescription,
      images: [socialImage]
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
    institutions: t('nav.institutions'),
    subjects: t('nav.subjects'),
    explore: t('nav.explore'),
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
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Ethnos Bibliography',
    url: new URL(localizedPath(locale as Locale, '/'), metadataBase).toString(),
    potentialAction: {
      '@type': 'SearchAction',
      target: searchTarget,
      'query-input': 'required name=search_term_string'
    },
    inLanguage: locale
  };

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
        <NextIntlClientProvider locale={locale} messages={messages}>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
        <LocaleLink className="nav-breadcrumb" href="/institutions">{navLinks.institutions}</LocaleLink>
        <span className="breadcrumb-separator" aria-hidden="true"> • </span>
        <LocaleLink className="nav-breadcrumb" href="/subjects">{navLinks.subjects}</LocaleLink>
        <span className="breadcrumb-separator" aria-hidden="true"> • </span>
        <LocaleLink className="nav-breadcrumb" href="/explore">{navLinks.explore}</LocaleLink>
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
        <a href="https://ethnos.app" target="_blank" rel="noopener noreferrer">{strings.project}</a> • {strings.openSource} • <LocaleLink href="/license">{strings.license}</LocaleLink> • {strings.frontendVersion} • <LocaleLink href="/privacy">{strings.privacy}</LocaleLink> • {strings.apiDocs}: <a href="https://api.ethnos.app/docs" target="_blank" rel="noopener noreferrer">api.ethnos.app/docs</a> • {strings.apiSource}: <a href="https://github.com/bzuer/ethnos-app" target="_blank" rel="noopener noreferrer">GitHub</a> • {strings.doi}: 10.5281/zenodo.17049435 • {strings.frontendSource}: <a href="https://github.com/bzuer/ethnos-app" target="_blank" rel="noopener noreferrer">GitHub</a> • {strings.doi}: 10.5281/zenodo.17050053 • <a href="https://cruz.rio.br" target="_blank" rel="noopener noreferrer">cruz.rio.br</a> • {strings.tagline}
      </div>
    </footer>
  );
}
