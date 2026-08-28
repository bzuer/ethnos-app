import { pruneJsonLd, serializeJsonLd, type JsonLdValue } from '@/lib/structured-data';

export default function JsonLd({ data }: { data: JsonLdValue }) {
  const pruned = pruneJsonLd(data);
  if (pruned === undefined) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(pruned) }} />;
}
