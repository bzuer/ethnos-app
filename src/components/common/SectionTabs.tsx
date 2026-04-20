'use client';

import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export type SectionTabDescriptor = {
  key: string;
  label: string;
  content: ReactNode;
};

type Props = {
  ariaLabel: string;
  tabs: SectionTabDescriptor[];
};

export default function SectionTabs({ ariaLabel, tabs }: Props) {
  const activeTabs = useMemo(() => tabs.filter((tab) => tab.content !== null && tab.content !== undefined && tab.content !== false), [tabs]);
  const [active, setActive] = useState<string | null>(activeTabs[0]?.key ?? null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement | null>());

  const focusTab = useCallback((key: string) => {
    const button = tabRefs.current.get(key);
    if (button) button.focus();
  }, []);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (activeTabs.length === 0) return;
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % activeTabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + activeTabs.length) % activeTabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = activeTabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = activeTabs[nextIndex];
    setActive(nextTab.key);
    focusTab(nextTab.key);
  }, [activeTabs, focusTab]);

  if (activeTabs.length === 0) return null;

  const activeTab = activeTabs.find((tab) => tab.key === active) || activeTabs[0];

  return (
    <section aria-label={ariaLabel}>
      <div className="title-section title-section-tabs" role="tablist" aria-label={ariaLabel}>
        {activeTabs.map((tab, index) => {
          const isActive = tab.key === activeTab.key;
          const tabId = `${tab.key}-tab`;
          const panelId = `${tab.key}-panel`;
          return (
            <button
              key={tab.key}
              ref={(node) => { tabRefs.current.set(tab.key, node); }}
              type="button"
              role="tab"
              id={tabId}
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              className={`section-tab${isActive ? ' is-active' : ''}`}
              onClick={() => setActive(tab.key)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {activeTabs.map((tab) => (
        <div
          key={tab.key}
          id={`${tab.key}-panel`}
          role="tabpanel"
          aria-labelledby={`${tab.key}-tab`}
          tabIndex={0}
          hidden={tab.key !== activeTab.key}
        >
          {tab.content}
        </div>
      ))}
    </section>
  );
}
