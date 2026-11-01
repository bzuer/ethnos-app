import type { ReactNode } from 'react';
import SectionTabs, { type SectionTabDescriptor } from '@/components/common/SectionTabs';

type Props = {
  ariaLabel: string;
  abstractLabel: string;
  citationsLabel: string;
  referencesLabel: string;
  impactLabel: string;
  filesLabel: string;
  abstract?: ReactNode;
  citations?: ReactNode;
  references?: ReactNode;
  impact?: ReactNode;
  files?: ReactNode;
};

export default function WorkSectionTabs({
  ariaLabel,
  abstractLabel,
  citationsLabel,
  referencesLabel,
  impactLabel,
  filesLabel,
  abstract,
  citations,
  references,
  impact,
  files
}: Props) {
  const tabs: SectionTabDescriptor[] = [];
  if (abstract) tabs.push({ key: 'abstract', label: abstractLabel, content: abstract });
  if (citations) tabs.push({ key: 'citations', label: citationsLabel, content: citations });
  if (references) tabs.push({ key: 'references', label: referencesLabel, content: references });
  if (impact) tabs.push({ key: 'impact', label: impactLabel, content: impact });
  if (files) tabs.push({ key: 'files', label: filesLabel, content: files });
  return <SectionTabs ariaLabel={ariaLabel} tabs={tabs} />;
}
