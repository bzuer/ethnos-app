'use client';

import { useEffect, type ComponentProps } from 'react';
import { Link, useRouter } from '@/i18n/routing';

type Props = ComponentProps<typeof Link> & { warm?: boolean };

const INTERACTION_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel'] as const;

export default function LocaleLink({ prefetch, warm = false, ...props }: Props) {
  const router = useRouter();
  const { href } = props;

  useEffect(() => {
    if (!warm) return undefined;
    const detach = () => INTERACTION_EVENTS.forEach((type) => window.removeEventListener(type, prefetchOnce));
    const prefetchOnce = () => {
      detach();
      router.prefetch(href as Parameters<typeof router.prefetch>[0]);
    };
    INTERACTION_EVENTS.forEach((type) => window.addEventListener(type, prefetchOnce, { passive: true }));
    return detach;
  }, [warm, router, href]);

  return <Link {...props} prefetch={prefetch ?? false} />;
}
