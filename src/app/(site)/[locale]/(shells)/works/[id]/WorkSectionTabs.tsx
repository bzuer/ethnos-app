import type { ReactNode } from 'react';
import SectionTabs, { type SectionTabDescriptor } from '@/components/common/SectionTabs';

type Props = {
  ariaLabel: string;
  abstractLabel: string;
  referencesLabel: string;
  citationsLabel: string;
  toolsLabel: string;
  abstract?: ReactNode;
  references?: ReactNode;
  citations?: ReactNode;
  tools?: ReactNode;
};

export default function WorkSectionTabs({
  ariaLabel,
  abstractLabel,
  referencesLabel,
  citationsLabel,
  toolsLabel,
  abstract,
  references,
  citations,
  tools
}: Props) {
  const tabs: SectionTabDescriptor[] = [];
  if (abstract) tabs.push({ key: 'abstract', label: abstractLabel, content: abstract });
  if (references) tabs.push({ key: 'references', label: referencesLabel, content: references });
  if (citations) tabs.push({ key: 'citations', label: citationsLabel, content: citations });
  if (tools) tabs.push({ key: 'tools', label: toolsLabel, content: tools });
  return <SectionTabs ariaLabel={ariaLabel} tabs={tabs} />;
}
