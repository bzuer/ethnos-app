'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { actAutocompleteSuggest } from '@/lib/actions';
import { localizedPath } from '@/i18n/paths';
import type { Locale } from '@/i18n/config';

type Suggestion = {
  key: string;
  text: string;
  meta: string;
  type: 'title' | 'author' | 'venue';
  href: string;
};

type Props = {
  inputId: string;
  inputName: string;
  placeholder: string;
  inputClassName?: string;
  defaultValue?: string;
  ariaLabel?: string;
  onSelect?: (suggestion: Suggestion) => void;
};

const DEBOUNCE_MS = 280;
const MIN_CHARS = 2;
const MAX_RESULTS = 8;

export default function SearchAutocomplete({
  inputId,
  inputName,
  placeholder,
  inputClassName = 'form-input',
  defaultValue = '',
  ariaLabel,
  onSelect,
}: Props) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildHref = useCallback((type: Suggestion['type'], text: string) => {
    const base = localizedPath(locale, '/search/results');
    const enc = encodeURIComponent(text);
    const param = type === 'author' ? `author=${enc}` : type === 'venue' ? `venue=${enc}` : `q=${enc}`;
    return `${base}?${param}`;
  }, [locale]);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let payload: Awaited<ReturnType<typeof actAutocompleteSuggest>>;
    try {
      payload = await actAutocompleteSuggest(q);
    } catch {
      return;
    }
    if (controller.signal.aborted) return;

    const results: Suggestion[] = payload.slice(0, MAX_RESULTS).map((s, idx) => ({
      key: `${s.type}-${idx}-${s.text}`,
      text: s.text,
      meta: s.workCount ? t('common.meta.worksCount', { count: s.workCount }) : '',
      type: s.type,
      href: buildHref(s.type, s.text),
    }));

    setSuggestions(results);
    setOpen(results.length > 0);
    setHighlighted(-1);
  }, [buildHref, t]);

  const handleInput = useCallback((value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (value.trim().length < MIN_CHARS) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(() => fetchSuggestions(value.trim()), DEBOUNCE_MS);
  }, [fetchSuggestions]);

  const selectItem = useCallback((item: Suggestion) => {
    setQuery(item.text);
    setOpen(false);
    setHighlighted(-1);
    if (onSelect) {
      onSelect(item);
    } else {
      window.location.assign(item.href);
    }
  }, [onSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault();
      selectItem(suggestions[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlighted(-1);
    }
  }, [open, suggestions, highlighted, selectItem]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    setQuery(defaultValue);
  }, [defaultValue]);

  const typeClassName = (type: string) => {
    if (type === 'title') return 'suggestion-type suggestion-type-title';
    if (type === 'venue') return 'suggestion-type suggestion-type-venue';
    if (type === 'author') return 'suggestion-type suggestion-type-author';
    return 'suggestion-type';
  };

  const typeLabel = (type: Suggestion['type']) => {
    if (type === 'venue') return t('common.labels.venue');
    if (type === 'author') return t('common.labels.author');
    return t('common.labels.work');
  };

  return (
    <div className="search-input-wrapper" ref={wrapperRef}>
      <input
        ref={inputRef}
        className={inputClassName}
        type="text"
        id={inputId}
        name={inputName}
        placeholder={placeholder}
        autoComplete="off"
        value={query}
        onChange={e => handleInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${inputId}-suggestions`}
        aria-activedescendant={highlighted >= 0 ? `${inputId}-suggestion-${highlighted}` : undefined}
      />
      <div
        id={`${inputId}-suggestions`}
        className={`autocomplete-suggestions${open ? ' active' : ''}`}
        role="listbox"
      >
        {suggestions.map((item, idx) => (
          <div
            key={item.key}
            id={`${inputId}-suggestion-${idx}`}
            className={`autocomplete-suggestion${idx === highlighted ? ' highlighted' : ''}`}
            role="option"
            aria-selected={idx === highlighted}
            onMouseEnter={() => setHighlighted(idx)}
            onMouseDown={e => { e.preventDefault(); selectItem(item); }}
          >
            <span className={typeClassName(item.type)}>{typeLabel(item.type)}</span>
            <span className="suggestion-text">{item.text}</span>
            {item.meta ? <span className="suggestion-meta">{item.meta}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
