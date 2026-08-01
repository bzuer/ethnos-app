import { WorkResultList, type WorkResultLabels } from '@/components/common/WorkResultItem';

type Props = {
  items: any[];
  labels: WorkResultLabels;
};

export default function VenueWorksList({ items, labels }: Props) {
  return <WorkResultList items={items} labels={labels} showVenue={false} titleMaxLength={200} />;
}
