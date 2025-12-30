import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildPageMetadata } from '@/i18n/metadata';

export const dynamic = 'force-static';
export const revalidate = false;

type ListItem = { text: string; children: ListItem[] };

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: ListItem[] };

export async function generateMetadata(props: { params: Promise<{ locale: string }> }) {
  return buildPageMetadata(props.params, 'metadata.privacy');
}

function parseMarkdown(source: string): Block[] {
  const lines = source.split(/\r?\n/);
  const blocks: Block[] = [];
  const isHeading = (line: string) => /^#{1,6}\s+/.test(line);
  const isList = (line: string) => /^\s*-\s+/.test(line);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (isHeading(line)) {
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        blocks.push({ kind: 'heading', level: match[1].length, text: match[2].trim() });
      }
      i += 1;
      continue;
    }
    if (isList(line)) {
      const parsed = parseList(lines, i);
      blocks.push({ kind: 'list', items: parsed.items });
      i = parsed.nextIndex;
      continue;
    }
    const parts: string[] = [];
    while (i < lines.length && lines[i].trim() && !isHeading(lines[i]) && !isList(lines[i])) {
      parts.push(lines[i].trim());
      i += 1;
    }
    if (parts.length) {
      blocks.push({ kind: 'paragraph', text: parts.join(' ') });
    }
  }
  return blocks;
}

function parseList(lines: string[], startIndex: number) {
  const root: ListItem[] = [];
  const stack: Array<{ indent: number; items: ListItem[] }> = [{ indent: -1, items: root }];
  let i = startIndex;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) break;
    const match = line.match(/^(\s*)-\s+(.*)$/);
    if (!match) break;
    const indent = match[1].length;
    const text = match[2].trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const item: ListItem = { text, children: [] };
    stack[stack.length - 1].items.push(item);
    stack.push({ indent, items: item.children });
    i += 1;
  }
  return { items: root, nextIndex: i };
}

function renderInline(text: string) {
  const parts = text.split('`');
  return parts.map((part, index) => {
    if (index % 2 === 1) return <code key={`${index}-${part}`}>{part.toUpperCase()}</code>;
    return part.toUpperCase();
  });
}

function renderList(items: ListItem[], keyPrefix: string) {
  return (
    <ul className="info-list">
      {items.map((item, index) => (
        <li key={`${keyPrefix}-${index}`}>
          <p className="description">{renderInline(item.text)}</p>
          {item.children.length ? renderList(item.children, `${keyPrefix}-${index}`) : null}
        </li>
      ))}
    </ul>
  );
}

export default async function PrivacyPage() {
  const markdownPath = join(process.cwd(), 'docs', 'PRIVACY_AND_COOKIES.md');
  const markdown = await readFile(markdownPath, 'utf8');
  const blocks = parseMarkdown(markdown);
  const titleBlock = blocks[0]?.kind === 'heading' && blocks[0].level === 1 ? blocks[0] : null;
  const title = titleBlock ? titleBlock.text.toUpperCase() : 'PRIVACY AND COOKIES';
  const contentBlocks = titleBlock ? blocks.slice(1) : blocks;

  return (
    <div className="page-header" aria-labelledby="page-title">
      <h1 className="page-title" id="page-title">{title}</h1>
      <section aria-labelledby="page-title">
        <div className="info-box">
          {contentBlocks.map((block, index) => {
            if (block.kind === 'heading') {
              return <p className="field-value" key={`h-${index}`}>{block.text.toUpperCase()}</p>;
            }
            if (block.kind === 'list') {
              return <div key={`list-${index}`}>{renderList(block.items, `list-${index}`)}</div>;
            }
            return <p className="description" key={`p-${index}`}>{renderInline(block.text)}</p>;
          })}
        </div>
      </section>
    </div>
  );
}
