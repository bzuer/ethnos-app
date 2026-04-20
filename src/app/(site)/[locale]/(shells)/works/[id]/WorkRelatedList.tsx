import LocaleLink from '@/components/common/LocaleLink';
import WorkMetaBadges from '@/components/common/WorkMetaBadges';
import { formatMetadataVenue, getWorkAbstractSnippet, isWorkOpenAccess } from '@/lib/works';
import type { ReactNode } from 'react';

type Labels = {
  titleUnavailable: string;
  authorUnknown: string;
  openAccess: string;
  addToList: string;
  inList: string;
  removeFromList: string;
  added: string;
  itemRemoved: string;
  citedBy: string;
  references: string;
};

type Props = {
  items: any[];
  labels: Labels;
  pickAuthors: (item: any) => string;
};

export default function WorkRelatedList({ items, labels, pickAuthors }: Props): ReactNode {
  return (
    <ul className="results-list">
      {items.map((item: any, idx: number) => {
        const id = item?.id || item?.work_id;
        const title = item?.title || item?.work_title || labels.titleUnavailable;
        const authors = pickAuthors(item);
        const year = item?.publication_year || item?.year || '';
        const venue = formatMetadataVenue(item, 35);
        const abstract = getWorkAbstractSnippet(item);
        const isOpen = isWorkOpenAccess(item);
        const citedByCount = Number(item?.cited_by_count);
        const referencesCount = Number(item?.references_count);
        const badgeProps = {
          work: item,
          openAccess: isOpen,
          openAccessLabel: labels.openAccess,
          addToListLabel: labels.addToList,
          inListLabel: labels.inList,
          removeFromListLabel: labels.removeFromList,
          addedMessage: labels.added,
          removedMessage: labels.itemRemoved
        };
        return (
          <li className="result-item" key={id || idx}>
            <h3 className="result-title">
              {id ? (
                <LocaleLink className="result-link" href={`/works/${id}`}>{title}</LocaleLink>
              ) : (
                <span className="field-value">{title}</span>
              )}
            </h3>
            <p className="result-meta">
              {isOpen ? (
                <>
                  <WorkMetaBadges {...badgeProps} showListBadge={false} />
                  <span className="meta-separator" aria-hidden="true">•</span>
                </>
              ) : null}
              <span className="result-authors">{authors || labels.authorUnknown}</span>
              {venue ? (
                <>
                  <span className="meta-separator" aria-hidden="true">•</span>
                  <span className="result-venue">{venue}</span>
                </>
              ) : null}
              {year ? (
                <>
                  <span className="meta-separator" aria-hidden="true">•</span>
                  <span className="result-year">{year}</span>
                </>
              ) : null}
              {Number.isFinite(citedByCount) && citedByCount > 0 ? (
                <>
                  <span className="meta-separator" aria-hidden="true">•</span>
                  <span className="result-cited">{labels.citedBy}: {citedByCount}</span>
                </>
              ) : null}
              {Number.isFinite(referencesCount) && referencesCount > 0 ? (
                <>
                  <span className="meta-separator" aria-hidden="true">•</span>
                  <span className="result-refs">{labels.references}: {referencesCount}</span>
                </>
              ) : null}
            </p>
            {id ? (
              <p className="result-meta result-badges">
                <WorkMetaBadges {...badgeProps} showOpenAccessBadge={false} showListBadge={true} />
              </p>
            ) : null}
            {abstract ? <p className="result-abstract">{abstract}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
