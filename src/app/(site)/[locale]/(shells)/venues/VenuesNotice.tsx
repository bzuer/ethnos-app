'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function VenuesNotice() {
  const t = useTranslations();
  const params = useSearchParams();
  const notice = params.get('notice');
  const isTargetNotice = notice === 'venue-not-found';
  const [visible, setVisible] = useState(isTargetNotice);

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    if (isTargetNotice) {
      showTimer = setTimeout(() => setVisible(true), 0);
      hideTimer = setTimeout(() => setVisible(false), 4500);
    } else {
      showTimer = setTimeout(() => setVisible(false), 0);
    }
    return () => {
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [isTargetNotice]);

  if (!visible || !isTargetNotice) return null;

  return (
    <p className="temporary-message temporary-message-info" role="status" aria-live="polite">
      <span className="sr-only">{t('common.messages.venueNotFoundRedirect')}</span>
      <span aria-hidden="true">{t('common.messages.venueNotFoundRedirectShort')}</span>
    </p>
  );
}
