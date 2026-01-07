'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export default function ScrollTools() {
  const t = useTranslations();
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  useEffect(() => {
    const update = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const height = doc.scrollHeight || 0;
      const viewport = window.innerHeight || 0;
      const threshold = 200;
      const canScroll = height > viewport + threshold;
      if (!canScroll) {
        setShowTop(false);
        setShowBottom(false);
        return;
      }
      setShowTop(scrollTop > threshold);
      setShowBottom(scrollTop + viewport < height - threshold);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  if (!showTop && !showBottom) return null;

  const onTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onBottom = () => {
    const height = document.documentElement.scrollHeight || 0;
    window.scrollTo({ top: height, behavior: 'smooth' });
  };

  return (
    <div className="scroll-tools" aria-hidden={!showTop && !showBottom}>
      {showTop ? (
        <button type="button" className="scroll-tool" onClick={onTop} aria-label={t('common.actions.scrollTop')}>
          <span aria-hidden="true">↑</span>
          <span className="sr-only">{t('common.actions.scrollTop')}</span>
        </button>
      ) : null}
      {showBottom ? (
        <button type="button" className="scroll-tool" onClick={onBottom} aria-label={t('common.actions.scrollBottom')}>
          <span aria-hidden="true">↓</span>
          <span className="sr-only">{t('common.actions.scrollBottom')}</span>
        </button>
      ) : null}
    </div>
  );
}
