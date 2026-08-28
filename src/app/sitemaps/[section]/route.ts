import { SITEMAP_SECTIONS, parseSitemapSection, renderSitemapSection } from '@/lib/sitemap';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return SITEMAP_SECTIONS.map((section) => ({ section: `${section}.xml` }));
}

export async function GET(_request: Request, context: { params: Promise<{ section: string }> }) {
  const { section } = await context.params;
  const resolved = parseSitemapSection(section);
  if (!resolved) {
    return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  const body = await renderSitemapSection(resolved);
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400'
    }
  });
}
