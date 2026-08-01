import { Fragment, type ReactNode } from 'react';
import LocaleLink from '@/components/common/LocaleLink';
import WorkMetaBadges from '@/components/common/WorkMetaBadges';
import {
  formatMetadataAuthors,
  formatMetadataType,
  formatMetadataVenue,
  getWorkAbstractSnippet,
  isWorkOpenAccess,
  truncateMetadataText
} from '@/lib/works';

export type WorkResultLabels = {
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
  roleFallback?: string;
  emptyState?: string;
};

type WorkResultItemProps = {
  item: any;
  labels: WorkResultLabels;
  showVenue?: boolean;
  showType?: boolean;
  showRelevance?: boolean;
  showAuthors?: boolean;
  useRoleFallback?: boolean;
  titleMaxLength?: number;
};

const Separator = () => <span className="meta-separator" aria-hidden="true">•</span>;

export function WorkResultItem({
  item,
  labels,
  showVenue = true,
  showType = true,
  showRelevance = false,
  showAuthors = true,
  useRoleFallback = false,
  titleMaxLength = 0
}: WorkResultItemProps) {
  const id = item?.id ?? item?.work_id ?? null;
  const rawTitle = item?.title || item?.work_title || '';
  const displayTitle = titleMaxLength > 0 && rawTitle.length > titleMaxLength
    ? `${rawTitle.slice(0, titleMaxLength)}…`
    : (rawTitle || labels.titleUnavailable);
  const openAccess = isWorkOpenAccess(item);
  const roleText = useRoleFallback
    ? truncateMetadataText(String(item?.role || item?.authorship_role || item?.authorship?.role || labels.roleFallback || '').toUpperCase(), 48)
    : '';
  const authors = formatMetadataAuthors(item, useRoleFallback ? '' : labels.authorUnknown);
  const authorsDisplay = authors || roleText || labels.authorUnknown;
  const type = showType ? formatMetadataType(item?.work_type || item?.type || '') : '';
  const venue = showVenue ? formatMetadataVenue(item, 35) : '';
  const year = item?.publication_year || item?.publication?.year || item?.year || '';
  const abstract = getWorkAbstractSnippet(item);
  const citedByCount = Number(item?.cited_by_count);
  const referencesCount = Number(item?.references_count);
  const relRaw = showRelevance ? (item?.relevance ?? item?.score ?? item?._score ?? item?.rank) : undefined;
  const relNum = typeof relRaw === 'number' ? relRaw : (relRaw ? Number(relRaw) : undefined);
  const rel = relNum && isFinite(relNum) ? relNum.toFixed(2) : '';
  const badgeProps = {
    work: item,
    openAccess,
    openAccessLabel: labels.openAccess,
    addToListLabel: labels.addToList,
    inListLabel: labels.inList,
    removeFromListLabel: labels.removeFromList,
    addedMessage: labels.added,
    removedMessage: labels.itemRemoved
  };
  const metaParts: ReactNode[] = [];
  if (showAuthors) metaParts.push(<span className="result-authors">{authorsDisplay}</span>);
  if (type) metaParts.push(<span className="result-type">{type}</span>);
  if (venue) metaParts.push(<span className="result-venue">{venue}</span>);
  if (year) metaParts.push(<span className="result-year">{year}</span>);
  if (Number.isFinite(citedByCount) && citedByCount > 0) metaParts.push(<span className="result-cited">{labels.citedBy}: {citedByCount}</span>);
  if (Number.isFinite(referencesCount) && referencesCount > 0) metaParts.push(<span className="result-refs">{labels.references}: {referencesCount}</span>);
  if (rel) metaParts.push(<span className="relevance-score">{rel}</span>);
  return (
    <li className="result-item">
      <h3 className="result-title">
        {id ? (
          <LocaleLink className="result-link" href={`/works/${id}`}>{displayTitle}</LocaleLink>
        ) : (
          <span className="field-value">{displayTitle}</span>
        )}
      </h3>
      <p className="result-meta">
        {openAccess ? (
          <>
            <WorkMetaBadges {...badgeProps} showListBadge={false} />
            {metaParts.length ? <Separator /> : null}
          </>
        ) : null}
        {metaParts.map((part, idx) => (
          <Fragment key={idx}>
            {idx > 0 ? <Separator /> : null}
            {part}
          </Fragment>
        ))}
      </p>
      {id ? (
        <p className="result-meta result-badges">
          <WorkMetaBadges {...badgeProps} showOpenAccessBadge={false} />
        </p>
      ) : null}
      {abstract ? <p className="result-abstract">{abstract}</p> : null}
    </li>
  );
}

type WorkResultListProps = Omit<WorkResultItemProps, 'item'> & { items: any[] };

export function WorkResultList({ items, labels, ...itemProps }: WorkResultListProps) {
  if (!items || items.length === 0) {
    return <div className="no-results"><p>{labels.emptyState || ''}</p></div>;
  }
  return (
    <ul className="results-list">
      {items.map((item: any, idx: number) => (
        <WorkResultItem key={item?.id ?? item?.work_id ?? idx} item={item} labels={labels} {...itemProps} />
      ))}
    </ul>
  );
}

export default WorkResultItem;
