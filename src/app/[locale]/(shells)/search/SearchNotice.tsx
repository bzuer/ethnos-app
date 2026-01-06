'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function SearchNotice() {
  const t = useTranslations();
  const params = useSearchParams();
  const notice = params.get('notice');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (notice === 'person-not-found' || notice === 'work-not-found') {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 4500);
      return () => clearTimeout(timer);
    }
    setVisible(false);
    return undefined;
  }, [notice]);

  if (!visible || (notice !== 'person-not-found' && notice !== 'work-not-found')) return null;

  const messageKey = notice === 'work-not-found' ? 'common.messages.workNotFoundRedirect' : 'common.messages.personNotFoundRedirect';
  const shortKey = notice === 'work-not-found' ? 'common.messages.workNotFoundRedirectShort' : 'common.messages.personNotFoundRedirectShort';

  return (
    <p className="temporary-message temporary-message-info" role="status" aria-live="polite">
      <span className="sr-only">{t(messageKey)}</span>
      <span aria-hidden="true">{t(shortKey)}</span>
    </p>
  );
}
