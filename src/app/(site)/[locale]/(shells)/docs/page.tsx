import { getTranslations } from 'next-intl/server';
import JsonLd from '@/components/common/JsonLd';
import LocaleLink from '@/components/common/LocaleLink';
import { buildPageMetadata } from '@/i18n/metadata';
import type { Locale } from '@/i18n/config';
import { DOCS_PATH, DOC_COLLECTIONS, docChapterPath, docCollectionPath } from '@/lib/docs';
import { buildBreadcrumbList } from '@/lib/structured-data';

export const dynamic = 'force-static';
export const revalidate = false;

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.docs', DOCS_PATH);
}

export default async function DocsIndexPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'docs' });
  const crumbs = await getTranslations({ locale, namespace: 'metadata.breadcrumbs' });

  return (
    <div className="page-header" lang="en" aria-labelledby="page-title">
      <JsonLd
        data={buildBreadcrumbList(locale as Locale, [
          { name: crumbs('home'), path: '/' },
          { name: crumbs('docs'), path: DOCS_PATH }
        ])}
      />
      <h1 className="page-title" id="page-title">{t('title')}</h1>
      <p className="doc-lead">{t('lead')}</p>
      {DOC_COLLECTIONS.map((collection) => (
        <section key={collection.id} className="doc-collection" aria-labelledby={`${collection.id}-heading`}>
          <h2 className="title-section" id={`${collection.id}-heading`}>{t(`collections.${collection.id}.title`)}</h2>
          <p className="doc-collection-summary">{t(`collections.${collection.id}.summary`)}</p>
          <div className="doc-collection-container">
            <div className="doc-table-scroll">
              <table className="data-table doc-chapters-table">
                <thead>
                  <tr>
                    <th scope="col">{t('table.number')}</th>
                    <th scope="col">{t('table.title')}</th>
                    <th scope="col">{t('table.summary')}</th>
                  </tr>
                </thead>
                <tbody>
                  {collection.chapters.map((chapter) => (
                    <tr key={chapter.slug}>
                      <td>{chapter.number}</td>
                      <td>
                        <LocaleLink className="table-link" href={docChapterPath(collection.id, chapter.slug)}>
                          {t(`chapters.${collection.id}.${chapter.slug}.title`)}
                        </LocaleLink>
                      </td>
                      <td>{t(`chapters.${collection.id}.${chapter.slug}.summary`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="action-links">
              <LocaleLink className="action-btn btn-positive" href={docCollectionPath(collection.id)}>
                {t(`collections.${collection.id}.cta`)}
              </LocaleLink>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
