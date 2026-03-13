'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Suggestion = {
  id: string | number;
  text: string;
  meta: string;
  type: 'title' | 'venue' | 'author';
  href: string;
};

type Props = {
  inputId: string;
  inputName: string;
  placeholder: string;
  inputClassName?: string;
  defaultValue?: string;
  typeLabel?: string;
  onSelect?: (suggestion: Suggestion) => void;
};

const DEBOUNCE_MS = 280;
const MIN_CHARS = 2;
const MAX_RESULTS = 6;

export default function SearchAutocomplete({
  inputId,
  inputName,
  placeholder,
  inputClassName = 'form-input',
  defaultValue = '',
  onSelect,
}: Props) {
  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const results: Suggestion[] = [];
    try {
      const [worksRes, venuesRes, personsRes] = await Promise.allSettled([
        fetch(`/api/search/works?q=${encodeURIComponent(q)}&limit=3`, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        }).then(r => r.ok ? r.json() : null),
        fetch(`/api/venues/search?q=${encodeURIComponent(q)}&limit=2`, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        }).then(r => r.ok ? r.json() : null),
        fetch(`/api/search/persons?q=${encodeURIComponent(q)}&limit=2`, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        }).then(r => r.ok ? r.json() : null),
      ]);

      if (worksRes.status === 'fulfilled' && worksRes.value) {
        const items = worksRes.value?.data || worksRes.value?.results || [];
        (Array.isArray(items) ? items : []).slice(0, 3).forEach((w: any) => {
          const year = w.publication_year || w.year || '';
          const authors = w.first_author || (Array.isArray(w.authors_preview) ? w.authors_preview[0] : '') || '';
          results.push({
            id: w.id,
            text: w.title || '',
            meta: [authors, year].filter(Boolean).join(' · '),
            type: 'title',
            href: `/works/${w.id}`,
          });
        });
      }

      if (venuesRes.status === 'fulfilled' && venuesRes.value) {
        const items = venuesRes.value?.data || venuesRes.value?.results || [];
        (Array.isArray(items) ? items : []).slice(0, 2).forEach((v: any) => {
          results.push({
            id: v.id,
            text: v.name || '',
            meta: [v.type, v.issn].filter(Boolean).join(' · '),
            type: 'venue',
            href: `/venues/${v.id}`,
          });
        });
      }

      if (personsRes.status === 'fulfilled' && personsRes.value) {
        const items = personsRes.value?.data || personsRes.value?.results || [];
        (Array.isArray(items) ? items : []).slice(0, 2).forEach((p: any) => {
          const name = p.preferred_name || (p.given_names && p.family_name ? `${p.given_names} ${p.family_name}` : '');
          results.push({
            id: p.id,
            text: name,
            meta: p.orcid ? `ORCID ${p.orcid}` : '',
            type: 'author',
            href: `/persons/${p.id}`,
          });
        });
      }
    } catch {
      return;
    }

    if (!controller.signal.aborted) {
      setSuggestions(results.slice(0, MAX_RESULTS));
      setOpen(results.length > 0);
      setHighlighted(-1);
    }
  }, []);

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
  }, [open, suggestions, highlighted]);

  const selectItem = useCallback((item: Suggestion) => {
    setQuery(item.text);
    setOpen(false);
    setHighlighted(-1);
    if (onSelect) {
      onSelect(item);
    } else {
      window.location.href = item.href;
    }
  }, [onSelect]);

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

  const typeClassName = (type: string) => {
    if (type === 'title') return 'suggestion-type suggestion-type-title';
    if (type === 'venue') return 'suggestion-type suggestion-type-venue';
    if (type === 'author') return 'suggestion-type suggestion-type-author';
    return 'suggestion-type';
  };

  const typeLabels: Record<string, string> = {
    title: 'WORK',
    venue: 'JOURNAL',
    author: 'PERSON',
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
            key={`${item.type}-${item.id}`}
            id={`${inputId}-suggestion-${idx}`}
            className={`autocomplete-suggestion${idx === highlighted ? ' highlighted' : ''}`}
            role="option"
            aria-selected={idx === highlighted}
            onMouseEnter={() => setHighlighted(idx)}
            onMouseDown={e => { e.preventDefault(); selectItem(item); }}
          >
            <span className={typeClassName(item.type)}>{typeLabels[item.type] || item.type}</span>
            <span className="suggestion-text">{item.text}</span>
            {item.meta ? <span className="suggestion-meta">{item.meta}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
