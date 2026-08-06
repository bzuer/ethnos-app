import type { ReactNode } from 'react';
import LocaleLink from '@/components/common/LocaleLink';
import { formatContributorName, type ContributorGroup } from '@/lib/works';

export type ContributorLabels = {
  roles: Record<string, string>;
  unknownName: string;
  corresponding: string;
};

function pickAffiliation(contributor: any) {
  const raw = contributor?.affiliation
    || (Array.isArray(contributor?.affiliations) ? contributor.affiliations[0] : undefined)
    || null;
  if (!raw) return { name: '', id: null as string | number | null };
  if (typeof raw === 'string') return { name: raw, id: null as string | number | null };
  return { name: raw?.name || '', id: raw?.id ?? null };
}

export default function WorkContributorRows({ groups, labels }: { groups: ContributorGroup[]; labels: ContributorLabels }): ReactNode {
  return (
    <>
      {groups.map((group) => (
        <tr key={group.role}>
          <th scope="row">{labels.roles[group.role] || labels.roles.OTHER}</th>
          <td className="field-value">
            {group.contributors.map((contributor: any, idx: number) => {
              const name = formatContributorName(contributor);
              const personId = contributor?.person_id ?? contributor?.id ?? null;
              const affiliation = pickAffiliation(contributor);
              const orcid = contributor?.identifiers?.orcid || contributor?.orcid || '';
              const notes = [
                orcid ? { key: 'orcid', node: <span>{orcid}</span> } : null,
                affiliation.name
                  ? {
                    key: 'affiliation',
                    node: affiliation.id !== null && affiliation.id !== undefined
                      ? <LocaleLink prefetch={false} className="action-link table-link" href={`/institutions/${affiliation.id}`}>{affiliation.name}</LocaleLink>
                      : <span>{affiliation.name}</span>
                  }
                  : null,
                contributor?.is_corresponding ? { key: 'corresponding', node: <span>{labels.corresponding}</span> } : null
              ].filter(Boolean) as Array<{ key: string; node: ReactNode }>;
              return (
                <span key={`${group.role}-${personId ?? idx}`}>
                  {personId !== null && personId !== undefined ? (
                    <LocaleLink prefetch={false} className="action-link table-link" href={`/persons/${personId}`}>{name || labels.unknownName}</LocaleLink>
                  ) : (
                    <span className="field-value">{name || labels.unknownName}</span>
                  )}
                  {notes.length ? ' (' : ''}
                  {notes.map((note, noteIdx) => (
                    <span key={note.key}>
                      {noteIdx > 0 ? ', ' : ''}
                      {note.node}
                    </span>
                  ))}
                  {notes.length ? ')' : ''}
                  {idx < group.contributors.length - 1 ? ', ' : ''}
                </span>
              );
            })}
          </td>
        </tr>
      ))}
    </>
  );
}
