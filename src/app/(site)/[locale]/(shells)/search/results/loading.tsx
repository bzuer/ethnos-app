'use client';

import { useTranslations } from 'next-intl';

export default function LoadingSearchResults() {
  const t = useTranslations();
  return (
    <div className="page-header" aria-busy="true" aria-live="polite">
      <h1 className="page-title">
        <span className="sr-only">{t('common.states.loadingWorks')}</span>
        <span aria-hidden="true" className="blinking-cursor">_</span>
      </h1>
      <p className="temporary-message temporary-message-info" role="status" aria-live="polite">
        <span className="sr-only">{t('common.states.loadingWorks')}</span>
        <span aria-hidden="true">{t('common.states.loadingWorks')}</span>
      </p>
    </div>
  );
}
