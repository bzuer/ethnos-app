import { WorkResultList, type WorkResultLabels } from '@/components/common/WorkResultItem';

type Props = {
  items: any[];
  labels: WorkResultLabels;
};

export default function PersonWorksList({ items, labels }: Props) {
  return <WorkResultList items={items} labels={labels} useRoleFallback titleMaxLength={200} />;
}
