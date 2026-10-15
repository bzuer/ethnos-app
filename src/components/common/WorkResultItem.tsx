import { Fragment, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import LocaleLink from '@/components/common/LocaleLink';
import ListToggleBadge from '@/components/common/ListToggleBadge';
import { formatNumber } from '@/lib/format';
import {
  formatMetadataAuthors,
  formatMetadataType,
  formatMetadataVenue,
  getWorkAbstractSnippet,
  getWorkOpenAccessDoiUrl,
  isWorkOpenAccess
} from '@/lib/works';
import { toListItem } from '@/lib/work-export';

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
  emptyState?: string;
};

type WorkResultItemProps = {
  item: any;
  labels: WorkResultLabels;
  showVenue?: boolean;
  showAuthors?: boolean;
  titleMaxLength?: number;
  pickAuthors?: (item: any) => string;
};

const Separator = () => <span className="meta-separator" aria-hidden="true">•</span>;

export function WorkResultItem({
  item,
  labels,
  showVenue = true,
  showAuthors = true,
  titleMaxLength = 0,
  pickAuthors
}: WorkResultItemProps) {
  const locale = useLocale();
  const id = item?.id ?? null;
  const rawTitle = item?.title || '';
  const displayTitle = titleMaxLength > 0 && rawTitle.length > titleMaxLength
    ? `${rawTitle.slice(0, titleMaxLength)}…`
    : (rawTitle || labels.titleUnavailable);
  const openAccess = isWorkOpenAccess(item);
  const authors = (pickAuthors ? pickAuthors(item) : formatMetadataAuthors(item)) || labels.authorUnknown;
  const role = item?.authorship?.role && item.authorship.role !== 'AUTHOR' ? String(item.authorship.role) : '';
  const type = formatMetadataType(item?.type || '');
  const venue = showVenue ? formatMetadataVenue(item, 35) : '';
  const year = item?.publication_year || item?.year || '';
  const abstract = getWorkAbstractSnippet(item);
  const citedByCount = Number(item?.cited_by_count);
  const referencesCount = Number(item?.references_count);
  const openAccessHref = openAccess ? getWorkOpenAccessDoiUrl(item) : '';
  const metaParts: ReactNode[] = [];
  if (showAuthors) metaParts.push(<span className="result-authors">{authors}</span>);
  if (role) metaParts.push(<span className="result-type">{role}</span>);
  if (type) metaParts.push(<span className="result-type">{type}</span>);
  if (venue) metaParts.push(<span className="result-venue">{venue}</span>);
  if (year) metaParts.push(<span className="result-year">{year}</span>);
  if (Number.isFinite(citedByCount) && citedByCount > 0) metaParts.push(<span className="result-cited">{labels.citedBy}: {formatNumber(citedByCount, locale)}</span>);
  if (Number.isFinite(referencesCount) && referencesCount > 0) metaParts.push(<span className="result-refs">{labels.references}: {formatNumber(referencesCount, locale)}</span>);
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
            {openAccessHref ? (
              <a className="badge open-acess badge-link" href={openAccessHref} target="_blank" rel="noopener noreferrer">{labels.openAccess}</a>
            ) : (
              <span className="badge open-acess">{labels.openAccess}</span>
            )}
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
          <ListToggleBadge
            item={{ ...toListItem(item), id }}
            labels={{ add: labels.addToList, inList: labels.inList, remove: labels.removeFromList, added: labels.added, removed: labels.itemRemoved }}
          />
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
        <WorkResultItem key={item?.id ?? idx} item={item} labels={labels} {...itemProps} />
      ))}
    </ul>
  );
}

export default WorkResultItem;
