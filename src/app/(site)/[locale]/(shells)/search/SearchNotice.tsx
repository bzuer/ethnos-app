'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function SearchNotice() {
  const t = useTranslations();
  const params = useSearchParams();
  const notice = params.get('notice');
  const isTargetNotice = notice === 'person-not-found' || notice === 'work-not-found';
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
  }, [isTargetNotice, notice]);

  if (!visible || !isTargetNotice) return null;

  const messageKey = notice === 'work-not-found' ? 'common.messages.workNotFoundRedirect' : 'common.messages.personNotFoundRedirect';
  const shortKey = notice === 'work-not-found' ? 'common.messages.workNotFoundRedirectShort' : 'common.messages.personNotFoundRedirectShort';

  return (
    <p className="temporary-message temporary-message-info" role="status" aria-live="polite">
      <span className="sr-only">{t(messageKey)}</span>
      <span aria-hidden="true">{t(shortKey)}</span>
    </p>
  );
}
