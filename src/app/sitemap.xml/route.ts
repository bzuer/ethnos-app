import { renderSitemapIndex } from '@/lib/sitemap';

export const dynamic = 'force-static';

export async function GET() {
  const body = await renderSitemapIndex();
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400'
    }
  });
}
