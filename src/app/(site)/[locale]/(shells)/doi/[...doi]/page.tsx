import { notFound } from 'next/navigation';
import { redirect } from '@/i18n/routing';
import { NON_INDEXABLE_ROBOTS } from '@/i18n/metadata';
import { resolveDoi } from '@/lib/endpoints';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return { robots: NON_INDEXABLE_ROBOTS };
}

export default async function DoiResolverPage(props: { params: Promise<{ locale: string; doi: string[] }> }) {
  const { locale, doi } = await props.params;
  const publication = await resolveDoi(doi.map(decodeURIComponent).join('/'));
  const workId = publication?.work?.id;
  if (!workId) notFound();
  redirect({ href: `/works/${workId}`, locale });
}
