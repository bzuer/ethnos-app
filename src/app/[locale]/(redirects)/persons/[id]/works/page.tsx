import { redirect } from '@/i18n/routing';
import { buildPageMetadata } from '@/i18n/metadata';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.persons');
}

export default async function PersonWorksRedirect(props: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await props.params;
  redirect({ href: `/persons/${id}`, locale });
}
