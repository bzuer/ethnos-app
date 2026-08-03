import type { ReactNode } from 'react';
import SectionTabs, { type SectionTabDescriptor } from '@/components/common/SectionTabs';

type Props = {
  ariaLabel: string;
  abstractLabel: string;
  citationsLabel: string;
  referencesLabel: string;
  toolsLabel: string;
  abstract?: ReactNode;
  citations?: ReactNode;
  references?: ReactNode;
  tools?: ReactNode;
};

export default function WorkSectionTabs({
  ariaLabel,
  abstractLabel,
  citationsLabel,
  referencesLabel,
  toolsLabel,
  abstract,
  citations,
  references,
  tools
}: Props) {
  const tabs: SectionTabDescriptor[] = [];
  if (abstract) tabs.push({ key: 'abstract', label: abstractLabel, content: abstract });
  if (citations) tabs.push({ key: 'citations', label: citationsLabel, content: citations });
  if (references) tabs.push({ key: 'references', label: referencesLabel, content: references });
  if (tools) tabs.push({ key: 'tools', label: toolsLabel, content: tools });
  return <SectionTabs ariaLabel={ariaLabel} tabs={tabs} />;
}
