import type { ReactNode } from 'react';
import SectionTabs, { type SectionTabDescriptor } from '@/components/common/SectionTabs';

type Props = {
  ariaLabel: string;
  abstractLabel: string;
  citationsLabel: string;
  referencesLabel: string;
  impactLabel: string;
  toolsLabel: string;
  abstract?: ReactNode;
  citations?: ReactNode;
  references?: ReactNode;
  impact?: ReactNode;
  tools?: ReactNode;
};

export default function WorkSectionTabs({
  ariaLabel,
  abstractLabel,
  citationsLabel,
  referencesLabel,
  impactLabel,
  toolsLabel,
  abstract,
  citations,
  references,
  impact,
  tools
}: Props) {
  const tabs: SectionTabDescriptor[] = [];
  if (abstract) tabs.push({ key: 'abstract', label: abstractLabel, content: abstract });
  if (citations) tabs.push({ key: 'citations', label: citationsLabel, content: citations });
  if (references) tabs.push({ key: 'references', label: referencesLabel, content: references });
  if (impact) tabs.push({ key: 'impact', label: impactLabel, content: impact });
  if (tools) tabs.push({ key: 'tools', label: toolsLabel, content: tools });
  return <SectionTabs ariaLabel={ariaLabel} tabs={tabs} />;
}
