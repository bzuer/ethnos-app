import { WorkResultList, type WorkResultLabels } from '@/components/common/WorkResultItem';
import type { ReactNode } from 'react';

type Props = {
  items: any[];
  labels: WorkResultLabels;
  pickAuthors?: (item: any) => string;
};

export default function WorkRelatedList({ items, labels }: Props): ReactNode {
  return <WorkResultList items={items} labels={labels} />;
}
