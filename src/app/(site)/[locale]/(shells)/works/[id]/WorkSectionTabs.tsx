import type { ReactNode } from 'react';
import SectionTabs, { type SectionTabDescriptor } from '@/components/common/SectionTabs';

type Props = {
  ariaLabel: string;
  abstractLabel: string;
  citationsLabel: string;
  referencesLabel: string;
  impactLabel: string;
  abstract?: ReactNode;
  citations?: ReactNode;
  references?: ReactNode;
  impact?: ReactNode;
};

export default function WorkSectionTabs({
  ariaLabel,
  abstractLabel,
  citationsLabel,
  referencesLabel,
  impactLabel,
  abstract,
  citations,
  references,
  impact
}: Props) {
  const tabs: SectionTabDescriptor[] = [];
  if (abstract) tabs.push({ key: 'abstract', label: abstractLabel, content: abstract });
  if (citations) tabs.push({ key: 'citations', label: citationsLabel, content: citations });
  if (references) tabs.push({ key: 'references', label: referencesLabel, content: references });
  if (impact) tabs.push({ key: 'impact', label: impactLabel, content: impact });
  return <SectionTabs ariaLabel={ariaLabel} tabs={tabs} />;
}
