export type IdentifierEntry = { label: string; values: Array<{ text: string; href?: string }> };

export function renderGroupedIdentifiers(entries: IdentifierEntry[], keyPrefix: string) {
  return entries.map((kv, kvIdx) => (
    <span key={`${keyPrefix}-${kv.label}-${kvIdx}`}>
      {kv.label}: {kv.values.map((entry, idx: number) => (
        <span key={`${keyPrefix}-${kv.label}-${entry.text}-${idx}`}>
          {entry.href ? (
            <a className="action-link table-link" href={entry.href} target="_blank" rel="noopener noreferrer">{entry.text}</a>
          ) : (
            <span>{entry.text}</span>
          )}
          {idx < kv.values.length - 1 ? ', ' : ''}
        </span>
      ))}
      {kvIdx < entries.length - 1 ? ' • ' : ''}
    </span>
  ));
}
