'use client';

import type { ComponentProps } from 'react';
import { Link } from '@/i18n/routing';

type Props = ComponentProps<typeof Link>;

export default function LocaleLink({ prefetch, ...props }: Props) {
  return <Link {...props} prefetch={prefetch ?? false} />;
}
