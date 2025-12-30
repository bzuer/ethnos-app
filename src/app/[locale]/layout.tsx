import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import LocaleLink from '@/components/common/LocaleLink';
import { locales, type Locale } from '@/i18n/config';

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

export const metadata: Metadata = {
  metadataBase: new URL('https://ethnos.app'),
  title: {
    template: '%s | Ethnos Bibliography',
    default: 'Ethnos Bibliography | Anthropology & Sociology Research Tool'
  },
  description: 'Ethnos delivers an open bibliography for anthropology and sociology, joining works, journals, metrics, and research tools in a single catalog.',
  abstract: 'Ethnos Bibliography is a reference discovery environment dedicated to anthropology, sociology, and ethnographic studies.',
  keywords: [
    'anthropology bibliography tool',
    'sociology research index',
    'ethnography reference platform',
    'open bibliographic database',
    'latin american social sciences catalog',
    'journals directory anthropology',
    'research metrics export'
  ],
  applicationName: 'Ethnos Bibliography',
  category: 'reference',
  creator: 'Ethnos Research Lab',
  publisher: 'Ethnos Research Lab',
  authors: [{ name: 'Ethnos Research Lab', url: 'https://ethnos.app' }],
  robots: {
    index: true,
    follow: true
  },
  alternates: {
    canonical: '/'
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ethnos.app/',
    title: 'Ethnos Bibliography | Anthropology & Sociology Research Tool',
    description: 'Open bibliography focused on anthropology and sociology with indexed works, journals, metrics, and export tools.',
    siteName: 'Ethnos Bibliography',
    images: [
      {
        url: 'https://ethnos.app/android-chrome-512x512.png',
        width: 512,
        height: 512,
        alt: 'Ethnos Bibliography interface symbol'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ethnos Bibliography | Anthropology & Sociology Research Tool',
    description: 'Discover anthropology and sociology works, journals, and research utilities in a unified open bibliography.',
    images: ['https://ethnos.app/android-chrome-512x512.png']
  },
  other: {
    'ethnos:disciplines': 'anthropology;sociology;ethnography;social sciences',
    'ethnos:capabilities': 'bibliographic indexing;scholarly discovery;reference export;open research observatory',
    'ethnos:audiences': 'researchers;students;librarians;documentation centers'
  }
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) notFound();
  setRequestLocale(locale as Locale);
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
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
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
      </div>
    </NextIntlClientProvider>
  );
}

function Header({ navLabel, navLinks, listCounterLabel }: { navLabel: string; navLinks: NavLinks; listCounterLabel: string }) {
  return (
    <header className="global-header" role="banner">
      <h1 className="title-primary">ETHNOS_APP</h1>
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
        <a href="https://ethnos.app" target="_blank" rel="noopener noreferrer">{strings.project}</a> • {strings.openSource} • <LocaleLink href="/license">{strings.license}</LocaleLink> • {strings.frontendVersion} • <LocaleLink href="/privacy">{strings.privacy}</LocaleLink> • {strings.apiDocs}: <a href="https://api.ethnos.app/docs" target="_blank" rel="noopener noreferrer">api.ethnos.app/docs</a> • {strings.apiSource}: <a href="https://github.com/bzuer/ethnos_app_api" target="_blank" rel="noopener noreferrer">GitHub</a> • {strings.doi}: 10.5281/zenodo.17049435 • {strings.frontendSource}: <a href="https://github.com/bzuer/ethnos_app_frontend" target="_blank" rel="noopener noreferrer">GitHub</a> • {strings.doi}: 10.5281/zenodo.17050053 • <a href="https://www.cruz.rio.br" target="_blank" rel="noopener noreferrer">cruz.rio.br</a> • {strings.tagline} •
      </div>
    </footer>
  );
}
