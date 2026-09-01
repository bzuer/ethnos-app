import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import DocArticle from '@/components/common/DocArticle';
import DocChapterNav from '@/components/common/DocChapterNav';
import DocContents from '@/components/common/DocContents';
import JsonLd from '@/components/common/JsonLd';
import { buildPageMetadata } from '@/i18n/metadata';
import type { Locale } from '@/i18n/config';
import { localeUrl } from '@/lib/site';
import {
  DOCS_PATH,
  DOC_COLLECTIONS,
  docChapterPath,
  docCollectionPath,
  getDocChapter,
  getDocCollection
} from '@/lib/docs';
import { buildBreadcrumbList, buildTechArticleNode } from '@/lib/structured-data';

export const dynamic = 'force-static';
export const revalidate = false;

export function generateStaticParams() {
  return DOC_COLLECTIONS.flatMap((collection) =>
    collection.chapters.map((chapter) => ({ collection: collection.id, slug: chapter.slug }))
  );
}

export async function generateMetadata(props: { params: Promise<{ locale: string; collection: string; slug: string }> }) {
  const { locale, collection, slug } = await props.params;
  const manifest = getDocCollection(collection);
  const entry = manifest ? manifest.chapters.find((chapter) => chapter.slug === slug) : null;
  const path = manifest && entry ? docChapterPath(manifest.id, entry.slug) : DOCS_PATH;
  const base = await buildPageMetadata(Promise.resolve({ locale }), 'metadata.docsChapter', path);
  if (!manifest || !entry) return base;
  const t = await getTranslations({ locale, namespace: 'docs' });
  const title = t(`chapters.${manifest.id}.${entry.slug}.title`);
  const description = t(`chapters.${manifest.id}.${entry.slug}.summary`);
  const url = localeUrl(locale as Locale, path);
  return {
    ...base,
    title,
    description,
    openGraph: base.openGraph ? { ...base.openGraph, type: 'article', title, description, url } : undefined,
    twitter: { ...(base.twitter || {}), title, description }
  };
}

export default async function DocChapterPage(props: { params: Promise<{ locale: string; collection: string; slug: string }> }) {
  const { locale, collection, slug } = await props.params;
  const manifest = getDocCollection(collection);
  if (!manifest) notFound();
  const chapter = await getDocChapter(manifest, slug);
  if (!chapter) notFound();
  const t = await getTranslations({ locale, namespace: 'docs' });
  const crumbs = await getTranslations({ locale, namespace: 'metadata.breadcrumbs' });
  const collectionTitle = t(`collections.${manifest.id}.title`);
  const chapterTitle = t(`chapters.${manifest.id}.${chapter.slug}.title`);
  const path = docChapterPath(manifest.id, chapter.slug);

  return (
    <div className="page-header" lang="en" aria-labelledby="page-title">
      <JsonLd
        data={buildBreadcrumbList(locale as Locale, [
          { name: crumbs('home'), path: '/' },
          { name: crumbs('docs'), path: DOCS_PATH },
          { name: collectionTitle, path: docCollectionPath(manifest.id) },
          { name: chapterTitle, path }
        ])}
      />
      <JsonLd
        data={buildTechArticleNode({
          locale: locale as Locale,
          path,
          name: chapterTitle,
          description: t(`chapters.${manifest.id}.${chapter.slug}.summary`),
          section: collectionTitle,
          position: chapter.number,
          inLanguage: 'en'
        })}
      />
      <p className="doc-folio">
        <span className="doc-folio-label">{t('chapterLabel')}</span>
        <span className="doc-folio-number">{chapter.number}</span>
      </p>
      <h1 className="page-title" id="page-title">{chapterTitle}</h1>
      {locale === 'en' ? null : <p className="doc-source-language">{t('sourceLanguage')}</p>}
      <DocContents outline={chapter.outline} label={t('contentsLabel')} />
      <DocArticle blocks={chapter.blocks} />
      <DocChapterNav
        label={t('chapterNavLabel')}
        previous={
          chapter.previous
            ? {
                href: docChapterPath(manifest.id, chapter.previous.slug),
                title: t(`chapters.${manifest.id}.${chapter.previous.slug}.title`)
              }
            : null
        }
        next={
          chapter.next
            ? {
                href: docChapterPath(manifest.id, chapter.next.slug),
                title: t(`chapters.${manifest.id}.${chapter.next.slug}.title`)
              }
            : null
        }
        index={{ href: docCollectionPath(manifest.id), title: t('indexLink') }}
        previousLabel={t('previous')}
        nextLabel={t('next')}
      />
    </div>
  );
}
