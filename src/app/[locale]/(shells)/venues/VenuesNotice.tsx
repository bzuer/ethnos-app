'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function VenuesNotice() {
  const t = useTranslations();
  const params = useSearchParams();
  const notice = params.get('notice');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (notice === 'venue-not-found') {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 4500);
      return () => clearTimeout(timer);
    }
    setVisible(false);
    return undefined;
  }, [notice]);

  if (!visible || notice !== 'venue-not-found') return null;

  return (
    <p className="temporary-message temporary-message-info" role="status" aria-live="polite">
      <span className="sr-only">{t('common.messages.venueNotFoundRedirect')}</span>
      <span aria-hidden="true">{t('common.messages.venueNotFoundRedirectShort')}</span>
    </p>
  );
}
