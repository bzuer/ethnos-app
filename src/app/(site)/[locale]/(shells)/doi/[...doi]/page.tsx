import { notFound } from 'next/navigation';
import { redirect } from '@/i18n/routing';
import { resolveDoi } from '@/lib/endpoints';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DoiResolverPage(props: { params: Promise<{ locale: string; doi: string[] }> }) {
  const { locale, doi } = await props.params;
  const doiString = Array.isArray(doi) ? doi.join('/') : String(doi || '');
  if (!doiString) notFound();
  const publication = await resolveDoi(doiString);
  const workId = publication?.work?.id ?? publication?.work_id ?? null;
  if (!workId) notFound();
  redirect({ href: `/works/${workId}`, locale });
}
