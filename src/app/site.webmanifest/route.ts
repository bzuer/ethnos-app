import { defaultLocale } from '@/i18n/config';
import { buildWebManifest, manifestResponse } from '@/lib/manifest';

export const dynamic = 'force-static';

export async function GET() {
  return manifestResponse(await buildWebManifest(defaultLocale));
}
