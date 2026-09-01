import LocaleLink from '@/components/common/LocaleLink';

export type DocChapterNavLink = {
  href: string;
  title: string;
  number?: number;
};

type Props = {
  label: string;
  previous: DocChapterNavLink | null;
  next: DocChapterNavLink | null;
  index: DocChapterNavLink;
  previousLabel: string;
  nextLabel: string;
};

export default function DocChapterNav({ label, previous, next, index, previousLabel, nextLabel }: Props) {
  return (
    <nav className="doc-chapter-nav" aria-label={label}>
      <div className="doc-chapter-nav-side">
        {previous ? (
          <LocaleLink className="doc-chapter-nav-link" href={previous.href} rel="prev">
            <span className="doc-chapter-nav-direction">{previousLabel}</span>
            <span className="doc-chapter-nav-title">{previous.title}</span>
          </LocaleLink>
        ) : null}
      </div>
      <LocaleLink className="doc-chapter-nav-index" href={index.href}>{index.title}</LocaleLink>
      <div className="doc-chapter-nav-side doc-chapter-nav-side-end">
        {next ? (
          <LocaleLink className="doc-chapter-nav-link" href={next.href} rel="next">
            <span className="doc-chapter-nav-direction">{nextLabel}</span>
            <span className="doc-chapter-nav-title">{next.title}</span>
          </LocaleLink>
        ) : null}
      </div>
    </nav>
  );
}
