import type { DocOutlineEntry } from '@/lib/docs';

type Props = {
  outline: DocOutlineEntry[];
  label: string;
};

export default function DocContents({ outline, label }: Props) {
  const entries = outline.filter((entry) => entry.level <= 3);
  if (entries.length < 3) return null;
  return (
    <nav className="doc-contents" aria-label={label}>
      <p className="doc-contents-label">{label}</p>
      <ol className="doc-contents-list">
        {entries.map((entry) => (
          <li key={entry.id} className={`doc-contents-item doc-contents-level-${entry.level}`}>
            <a className="doc-contents-link" href={`#${entry.id}`}>
              {entry.ordinal ? <span className="doc-contents-number">{entry.ordinal}</span> : null}
              <span className="doc-contents-text">{entry.text}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
