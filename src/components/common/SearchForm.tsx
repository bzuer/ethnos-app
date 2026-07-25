'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import SearchAutocomplete from '@/components/common/SearchAutocomplete';

type Props = {
  action: string;
  autocompleteId?: string;
  embedded?: boolean;
};

type FormState = {
  q: string;
  author: string;
  venue: string;
  subject: string;
  work_type: string;
  language: string;
  year_from: string;
  year_to: string;
  peer_reviewed: string;
  open_access: string;
  sort_by: string;
  sort_order: string;
  cited_by_min: string;
  cited_by_max: string;
  limit: string;
};

const LIMIT_OPTIONS = ['10', '20', '50'] as const;
const DEFAULT_LIMIT = '20';

function readState(searchParams: URLSearchParams | null): FormState {
  const get = (key: string) => {
    const v = searchParams?.get(key);
    return v == null ? '' : String(v);
  };
  const workType = get('work_type') || get('type') || '';
  const rawLimit = get('limit') || DEFAULT_LIMIT;
  const limit = (LIMIT_OPTIONS as readonly string[]).includes(rawLimit) ? rawLimit : DEFAULT_LIMIT;
  return {
    q: get('q'),
    author: get('author'),
    venue: get('venue'),
    subject: get('subject'),
    work_type: workType,
    language: get('language'),
    year_from: get('year_from'),
    year_to: get('year_to'),
    peer_reviewed: get('peer_reviewed'),
    open_access: get('open_access'),
    sort_by: get('sort_by'),
    sort_order: get('sort_order'),
    cited_by_min: get('cited_by_min'),
    cited_by_max: get('cited_by_max'),
    limit
  };
}

const EMPTY_STATE: FormState = {
  q: '', author: '', venue: '', subject: '', work_type: '', language: '',
  year_from: '', year_to: '', peer_reviewed: '', open_access: '',
  sort_by: '', sort_order: '', cited_by_min: '', cited_by_max: '', limit: DEFAULT_LIMIT
};

export default function SearchForm({ action, autocompleteId = 'q', embedded = false }: Props) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const fromUrl = useMemo<FormState>(
    () => readState(searchParams as URLSearchParams | null),
    [searchParams]
  );
  const [state, setState] = useState<FormState>(EMPTY_STATE);
  useEffect(() => {
    setState(fromUrl);
  }, [fromUrl]);

  const update = <K extends keyof FormState>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setState((prev) => ({ ...prev, [key]: e.target.value }));

  const reset = () => setState(EMPTY_STATE);

  const formClass = embedded ? 'search-form-embedded' : '';

  return (
    <form
      action={action}
      method="get"
      role="search"
      aria-label={t('common.meta.ariaSearchForm')}
      className={formClass}
    >
      <fieldset className="figure-plate">
        <legend className="form-label">{t('search.textLegend')}</legend>
        <div>
          <label className="form-label" htmlFor={autocompleteId}>{t('common.labels.term')}</label>
          <SearchAutocomplete
            inputId={autocompleteId}
            inputName="q"
            placeholder={t('common.placeholders.quickTerm')}
            defaultValue={state.q}
            ariaLabel={t('common.aria.searchInput')}
          />
        </div>
        <div className="search-filters">
          <div className="filter-label">
            <label className="form-label" htmlFor={`${autocompleteId}-author`}>{t('common.labels.author')}</label>
            <input
              className="form-input"
              type="text"
              id={`${autocompleteId}-author`}
              name="author"
              value={state.author}
              onChange={update('author')}
              placeholder={t('common.placeholders.person')}
            />
          </div>
          <div className="filter-label">
            <label className="form-label" htmlFor={`${autocompleteId}-venue`}>{t('common.labels.venue')}</label>
            <input
              className="form-input"
              type="text"
              id={`${autocompleteId}-venue`}
              name="venue"
              value={state.venue}
              onChange={update('venue')}
              placeholder={t('common.placeholders.venue')}
            />
          </div>
          <div className="filter-label">
            <label className="form-label" htmlFor={`${autocompleteId}-subject`}>{t('common.labels.subject')}</label>
            <input
              className="form-input"
              type="text"
              id={`${autocompleteId}-subject`}
              name="subject"
              value={state.subject}
              onChange={update('subject')}
              placeholder={t('common.placeholders.subject')}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="figure-plate">
        <legend className="form-label">{t('search.filtersLegend')}</legend>
        <div className="search-filters">
          <div className="filter-label">
            <label className="form-label" htmlFor={`${autocompleteId}-work_type`}>{t('common.labels.type')}</label>
            <select
              className="form-input"
              id={`${autocompleteId}-work_type`}
              name="work_type"
              value={state.work_type}
              onChange={update('work_type')}
            >
              <option value="">{t('common.options.any')}</option>
              <option value="ARTICLE">ARTICLE</option>
              <option value="BOOK">BOOK</option>
              <option value="CHAPTER">CHAPTER</option>
              <option value="CONFERENCE">CONFERENCE</option>
              <option value="CONFERENCE_PAPER">CONFERENCE_PAPER</option>
              <option value="THESIS">THESIS</option>
              <option value="REPORT">REPORT</option>
              <option value="DATASET">DATASET</option>
              <option value="PREPRINT">PREPRINT</option>
              <option value="REVIEW">REVIEW</option>
              <option value="EDITORIAL">EDITORIAL</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>
          <div className="filter-label">
            <label className="form-label" htmlFor={`${autocompleteId}-language`}>{t('common.labels.language')}</label>
            <input
              className="form-input"
              type="text"
              id={`${autocompleteId}-language`}
              name="language"
              value={state.language}
              onChange={update('language')}
              placeholder={t('common.placeholders.language')}
            />
          </div>
          <div className="filter-label">
            <label className="form-label" htmlFor={`${autocompleteId}-year_from`}>{t('common.labels.yearFrom')}</label>
            <input
              className="form-input"
              type="number"
              id={`${autocompleteId}-year_from`}
              name="year_from"
              value={state.year_from}
              onChange={update('year_from')}
              placeholder={t('common.placeholders.yearFrom')}
              min={1500}
              max={2100}
            />
          </div>
          <div className="filter-label">
            <label className="form-label" htmlFor={`${autocompleteId}-year_to`}>{t('common.labels.yearTo')}</label>
            <input
              className="form-input"
              type="number"
              id={`${autocompleteId}-year_to`}
              name="year_to"
              value={state.year_to}
              onChange={update('year_to')}
              placeholder={t('common.placeholders.yearTo')}
              min={1500}
              max={2100}
            />
          </div>
          <div className="filter-label">
            <label className="form-label" htmlFor={`${autocompleteId}-peer_reviewed`}>{t('common.labels.peerReviewed')}</label>
            <select
              className="form-input"
              id={`${autocompleteId}-peer_reviewed`}
              name="peer_reviewed"
              value={state.peer_reviewed}
              onChange={update('peer_reviewed')}
            >
              <option value="">{t('common.options.any')}</option>
              <option value="true">{t('common.values.yes')}</option>
              <option value="false">{t('common.values.no')}</option>
            </select>
          </div>
          <div className="filter-label">
            <label className="form-label" htmlFor={`${autocompleteId}-open_access`}>{t('common.labels.openAccess')}</label>
            <select
              className="form-input"
              id={`${autocompleteId}-open_access`}
              name="open_access"
              value={state.open_access}
              onChange={update('open_access')}
            >
              <option value="">{t('common.options.any')}</option>
              <option value="true">{t('common.values.yes')}</option>
              <option value="false">{t('common.values.no')}</option>
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="figure-plate">
        <legend className="form-label">{t('search.parametersLegend')}</legend>
        <div className="search-filters">
          <div className="filter-label">
            <label className="form-label" htmlFor={`${autocompleteId}-sort_by`}>{t('common.labels.sortBy')}</label>
            <select
              className="form-input"
              id={`${autocompleteId}-sort_by`}
              name="sort_by"
              value={state.sort_by}
              onChange={update('sort_by')}
            >
              <option value="">{t('common.options.relevance')}</option>
              <option value="cited_by_count">{t('common.options.citedByCount')}</option>
              <option value="publication_year">{t('common.options.publicationYear')}</option>
              <option value="references_count">{t('common.options.referencesCount')}</option>
            </select>
          </div>
          <div className="filter-label">
            <label className="form-label" htmlFor={`${autocompleteId}-sort_order`}>{t('common.labels.sortOrder')}</label>
            <select
              className="form-input"
              id={`${autocompleteId}-sort_order`}
              name="sort_order"
              value={state.sort_order}
              onChange={update('sort_order')}
            >
              <option value="">{t('common.options.descending')}</option>
              <option value="ASC">{t('common.options.ascending')}</option>
            </select>
          </div>
          <div className="filter-label">
            <label className="form-label" htmlFor={`${autocompleteId}-cited_by_min`}>{t('common.labels.citedByMin')}</label>
            <input
              className="form-input"
              type="number"
              id={`${autocompleteId}-cited_by_min`}
              name="cited_by_min"
              value={state.cited_by_min}
              onChange={update('cited_by_min')}
              min={0}
            />
          </div>
          <div className="filter-label">
            <label className="form-label" htmlFor={`${autocompleteId}-cited_by_max`}>{t('common.labels.citedByMax')}</label>
            <input
              className="form-input"
              type="number"
              id={`${autocompleteId}-cited_by_max`}
              name="cited_by_max"
              value={state.cited_by_max}
              onChange={update('cited_by_max')}
              min={0}
            />
          </div>
          <div className="filter-label">
            <label className="form-label" htmlFor={`${autocompleteId}-limit`}>{t('common.labels.itemsPerPage')}</label>
            <select
              className="form-input"
              id={`${autocompleteId}-limit`}
              name="limit"
              value={state.limit}
              onChange={update('limit')}
            >
              {LIMIT_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
      </fieldset>

      <div className="search-controls">
        <button className="action-btn btn-negative" type="button" onClick={reset}>{t('common.actions.clear')}</button>
        <button className="action-btn btn-positive" type="submit">{t('common.actions.runSearch')}</button>
      </div>
    </form>
  );
}
