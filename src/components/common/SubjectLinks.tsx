import LocaleLink from '@/components/common/LocaleLink';

export type SubjectLinkItem = {
  term: string;
  note?: string;
};

type Props = {
  subjects: SubjectLinkItem[];
  filters?: Record<string, string | number | null | undefined>;
};

function buildSearchHref(term: string, filters?: Props['filters']) {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    const text = value === null || value === undefined ? '' : String(value).trim();
    if (text) params.set(key, text);
  });
  params.set('subject', term);
  return `/search/results?${params.toString()}`;
}

export default function SubjectLinks({ subjects, filters }: Props) {
  const items = subjects.filter((subject) => subject && String(subject.term || '').trim());
  if (!items.length) return null;
  return (
    <p className="description subject-list">
      {items.map((subject, idx) => {
        const term = String(subject.term).trim();
        return (
          <span key={`${term}-${idx}`}>
            <LocaleLink prefetch={false} className="subject-link" href={buildSearchHref(term, filters)}>{term}</LocaleLink>
            {subject.note ? <span className="subject-count"> ({subject.note})</span> : null}
            {idx < items.length - 1 ? ' · ' : ''}
          </span>
        );
      })}
    </p>
  );
}
