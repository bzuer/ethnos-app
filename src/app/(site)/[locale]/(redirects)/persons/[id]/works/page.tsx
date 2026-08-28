import { permanentRedirect } from '@/i18n/routing';
import { buildPageMetadata } from '@/i18n/metadata';

export async function generateMetadata(props: { params: Promise<{ locale: string; id: string }> }) {
  const { id, locale } = await props.params;
  return buildPageMetadata(Promise.resolve({ locale }), 'metadata.persons', `/persons/${id}`);
}

export default async function PersonWorksRedirect(props: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await props.params;
  permanentRedirect({ href: `/persons/${id}`, locale });
}
