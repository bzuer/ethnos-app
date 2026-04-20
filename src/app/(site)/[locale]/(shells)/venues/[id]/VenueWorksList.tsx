import LocaleLink from '@/components/common/LocaleLink';
import WorkMetaBadges from '@/components/common/WorkMetaBadges';
import {
  formatMetadataAuthors,
  formatMetadataType,
  getWorkAbstractSnippet,
  isWorkOpenAccess
} from '@/lib/works';

type Labels = {
  titleUnavailable: string;
  authorUnknown: string;
  openAccess: string;
  addToList: string;
  inList: string;
  removeFromList: string;
  added: string;
  itemRemoved: string;
  emptyState: string;
  citedBy: string;
  references: string;
};

type Props = {
  items: any[];
  labels: Labels;
};

export default function VenueWorksList({ items, labels }: Props) {
  if (items.length === 0) {
    return <div className="no-results"><p>{labels.emptyState}</p></div>;
  }
  return (
    <ul className="results-list">
      {items.map((pub: any, idx: number) => {
        const id = pub?.id ?? null;
        const title = pub?.title || '';
        const displayTitle = title && title.length > 200 ? `${title.slice(0, 200)}…` : (title || labels.titleUnavailable);
        const authors = formatMetadataAuthors(pub, labels.authorUnknown);
        const year = pub?.publication_year || pub?.publication?.year || pub?.year || '';
        const type = formatMetadataType(pub?.work_type || pub?.type || '');
        const abstract = getWorkAbstractSnippet(pub);
        const openAccess = isWorkOpenAccess(pub);
        const citedByCount = Number(pub?.cited_by_count);
        const referencesCount = Number(pub?.references_count);
        const badgeProps = {
          work: pub,
          openAccess,
          openAccessLabel: labels.openAccess,
          addToListLabel: labels.addToList,
          inListLabel: labels.inList,
          removeFromListLabel: labels.removeFromList,
          addedMessage: labels.added,
          removedMessage: labels.itemRemoved
        };
        return (
          <li className="result-item" key={id ?? idx}>
            <h3 className="result-title">
              {id ? (
                <LocaleLink href={`/works/${id}`} className="result-link">{displayTitle}</LocaleLink>
              ) : (
                <span className="field-value">{displayTitle}</span>
              )}
            </h3>
            <p className="result-meta">
              {openAccess ? (
                <>
                  <WorkMetaBadges {...badgeProps} showListBadge={false} />
                  <span className="meta-separator" aria-hidden="true">•</span>
                </>
              ) : null}
              <span className="result-authors">{authors}</span>
              {year ? <><span className="meta-separator" aria-hidden="true">•</span><span className="result-year">{year}</span></> : null}
              {type ? <><span className="meta-separator" aria-hidden="true">•</span><span className="result-type">{type}</span></> : null}
              {Number.isFinite(citedByCount) && citedByCount > 0 ? (
                <><span className="meta-separator" aria-hidden="true">•</span><span className="result-cited">{labels.citedBy}: {citedByCount}</span></>
              ) : null}
              {Number.isFinite(referencesCount) && referencesCount > 0 ? (
                <><span className="meta-separator" aria-hidden="true">•</span><span className="result-refs">{labels.references}: {referencesCount}</span></>
              ) : null}
            </p>
            {id ? (
              <p className="result-meta result-badges">
                <WorkMetaBadges {...badgeProps} showOpenAccessBadge={false} />
              </p>
            ) : null}
            {abstract ? <p className="result-abstract">{abstract}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
