import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import DocArticle from '@/components/common/DocArticle';
import DocChapterNav from '@/components/common/DocChapterNav';
import JsonLd from '@/components/common/JsonLd';
import { buildPageMetadata } from '@/i18n/metadata';
import type { Locale } from '@/i18n/config';
import {
  DOCS_PATH,
  DOC_COLLECTIONS,
  docChapterPath,
  docCollectionPath,
  getDocCollection,
  getDocCollectionIndex
} from '@/lib/docs';
import { buildBreadcrumbList, buildCollectionPageNode } from '@/lib/structured-data';

export const dynamic = 'force-static';
export const revalidate = false;

export function generateStaticParams() {
  return DOC_COLLECTIONS.map((collection) => ({ collection: collection.id }));
}

export async function generateMetadata(props: { params: Promise<{ locale: string; collection: string }> }) {
  const { locale, collection } = await props.params;
  const manifest = getDocCollection(collection);
  if (!manifest) return buildPageMetadata(Promise.resolve({ locale }), 'metadata.docs', DOCS_PATH);
  return buildPageMetadata(Promise.resolve({ locale }), manifest.metadataKey, docCollectionPath(manifest.id));
}

export default async function DocCollectionPage(props: { params: Promise<{ locale: string; collection: string }> }) {
  const { locale, collection } = await props.params;
  const manifest = getDocCollection(collection);
  if (!manifest) notFound();
  const document = await getDocCollectionIndex(manifest);
  const t = await getTranslations({ locale, namespace: 'docs' });
  const crumbs = await getTranslations({ locale, namespace: 'metadata.breadcrumbs' });
  const title = t(`collections.${manifest.id}.title`);
  const first = manifest.chapters[0];

  return (
    <div className="page-header" lang="en" aria-labelledby="page-title">
      <JsonLd
        data={buildBreadcrumbList(locale as Locale, [
          { name: crumbs('home'), path: '/' },
          { name: crumbs('docs'), path: DOCS_PATH },
          { name: title, path: docCollectionPath(manifest.id) }
        ])}
      />
      <JsonLd
        data={buildCollectionPageNode({
          locale: locale as Locale,
          path: docCollectionPath(manifest.id),
          name: title,
          description: t(`collections.${manifest.id}.summary`),
          inLanguage: 'en',
          entries: manifest.chapters.map((chapter) => ({
            name: t(`chapters.${manifest.id}.${chapter.slug}.title`),
            path: docChapterPath(manifest.id, chapter.slug)
          }))
        })}
      />
      <h1 className="page-title" id="page-title">{title}</h1>
      {locale === 'en' ? null : <p className="doc-source-language">{t('sourceLanguage')}</p>}
      <DocArticle blocks={document.blocks} />
      {first ? (
        <DocChapterNav
          label={t('chapterNavLabel')}
          previous={null}
          next={{ href: docChapterPath(manifest.id, first.slug), title: t(`chapters.${manifest.id}.${first.slug}.title`) }}
          index={{ href: DOCS_PATH, title: crumbs('docs') }}
          previousLabel={t('previous')}
          nextLabel={t('next')}
        />
      ) : null}
    </div>
  );
}
