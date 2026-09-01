export type InlineNode =
  | { kind: 'text'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'strong'; children: InlineNode[] }
  | { kind: 'emphasis'; children: InlineNode[] }
  | { kind: 'link'; href: string; children: InlineNode[] };

export type TableAlignment = 'left' | 'center' | 'right';

export type HeadingBlock = {
  kind: 'heading';
  level: number;
  children: InlineNode[];
  text: string;
  id: string;
  ordinal: string;
};

export type BlockNode =
  | HeadingBlock
  | { kind: 'paragraph'; children: InlineNode[] }
  | { kind: 'list'; ordered: boolean; start: number; items: BlockNode[][] }
  | { kind: 'table'; alignment: TableAlignment[]; head: InlineNode[][]; rows: InlineNode[][][] }
  | { kind: 'code'; language: string | null; value: string }
  | { kind: 'quote'; children: BlockNode[] }
  | { kind: 'rule' }
  | { kind: 'anchor'; id: string };

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([A-Za-z0-9_+-]*)\s*$/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const ANCHOR = /^ {0,3}<a\s+id="([A-Za-z0-9_.:-]+)"\s*>\s*<\/a>\s*$/;
const LIST_ITEM = /^(\s*)(?:([-*+])|(\d{1,9})[.)])\s+(.*)$/;
const QUOTE = /^ {0,3}>[ \t]?(.*)$/;
const TABLE_DELIMITER = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const PUNCTUATION = /[\\`*_{}[\]()#+\-.!|<>~"']/;

export function parseMarkdown(source: string): BlockNode[] {
  const lines = source.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  return parseBlocks(lines);
}

export function inlineText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.kind === 'text' || node.kind === 'code') return node.value;
      return inlineText(node.children);
    })
    .join('');
}

export function slugifyHeading(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseBlocks(lines: string[]): BlockNode[] {
  const blocks: BlockNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1];
      const language = fence[2] || null;
      const body: string[] = [];
      index += 1;
      while (index < lines.length) {
        const current = lines[index];
        const closing = FENCE.exec(current);
        if (closing && closing[1][0] === marker[0] && closing[1].length >= marker.length && !closing[2]) {
          index += 1;
          break;
        }
        body.push(current);
        index += 1;
      }
      blocks.push({ kind: 'code', language, value: trimBlankEdges(body).join('\n') });
      continue;
    }
    const anchor = ANCHOR.exec(line);
    if (anchor) {
      blocks.push({ kind: 'anchor', id: anchor[1] });
      index += 1;
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      const children = parseInline(heading[2]);
      blocks.push({
        kind: 'heading',
        level: heading[1].length,
        children,
        text: inlineText(children),
        id: '',
        ordinal: ''
      });
      index += 1;
      continue;
    }
    if (RULE.test(line)) {
      blocks.push({ kind: 'rule' });
      index += 1;
      continue;
    }
    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (index < lines.length && (QUOTE.test(lines[index]) || (body.length > 0 && lines[index].trim() !== ''))) {
        const quoted = QUOTE.exec(lines[index]);
        if (!quoted) break;
        body.push(quoted[1]);
        index += 1;
      }
      blocks.push({ kind: 'quote', children: parseBlocks(body) });
      continue;
    }
    if (isTableStart(lines, index)) {
      const parsed = parseTable(lines, index);
      blocks.push(parsed.table);
      index = parsed.nextIndex;
      continue;
    }
    if (LIST_ITEM.test(line)) {
      const parsed = parseList(lines, index);
      blocks.push(parsed.list);
      index = parsed.nextIndex;
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !startsBlock(lines, index)) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    if (paragraph.length) blocks.push({ kind: 'paragraph', children: parseInline(paragraph.join(' ')) });
    else index += 1;
  }
  return blocks;
}

function startsBlock(lines: string[], index: number) {
  const line = lines[index];
  if (FENCE.test(line)) return true;
  if (HEADING.test(line)) return true;
  if (RULE.test(line)) return true;
  if (ANCHOR.test(line)) return true;
  if (QUOTE.test(line)) return true;
  if (LIST_ITEM.test(line)) return true;
  if (isTableStart(lines, index)) return true;
  return false;
}

function isTableStart(lines: string[], index: number) {
  const line = lines[index];
  if (!/^ {0,3}\|/.test(line)) return false;
  const next = lines[index + 1];
  return Boolean(next) && TABLE_DELIMITER.test(next) && next.includes('-');
}

function parseTable(lines: string[], startIndex: number) {
  const headCells = splitTableRow(lines[startIndex]);
  const delimiterCells = splitTableRow(lines[startIndex + 1]);
  const alignment: TableAlignment[] = delimiterCells.map((cell) => {
    const trimmed = cell.trim();
    const left = trimmed.startsWith(':');
    const right = trimmed.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return 'left';
  });
  const rows: InlineNode[][][] = [];
  let index = startIndex + 2;
  while (index < lines.length && /^ {0,3}\|/.test(lines[index]) && lines[index].trim()) {
    rows.push(splitTableRow(lines[index]).map((cell) => parseInline(cell.trim())));
    index += 1;
  }
  return {
    table: {
      kind: 'table' as const,
      alignment,
      head: headCells.map((cell) => parseInline(cell.trim())),
      rows
    },
    nextIndex: index
  };
}

function splitTableRow(line: string) {
  const cells: string[] = [];
  let buffer = '';
  let index = 0;
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  while (index < trimmed.length) {
    const char = trimmed[index];
    if (char === '\\' && index + 1 < trimmed.length) {
      buffer += char + trimmed[index + 1];
      index += 2;
      continue;
    }
    if (char === '|') {
      cells.push(buffer);
      buffer = '';
      index += 1;
      continue;
    }
    buffer += char;
    index += 1;
  }
  cells.push(buffer);
  return cells;
}

function parseList(lines: string[], startIndex: number) {
  const first = LIST_ITEM.exec(lines[startIndex]);
  if (!first) return { list: { kind: 'list' as const, ordered: false, start: 1, items: [] }, nextIndex: startIndex + 1 };
  const baseIndent = first[1].length;
  const ordered = Boolean(first[3]);
  const start = ordered ? Number(first[3]) : 1;
  const groups: string[][] = [];
  let current: string[] | null = null;
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      const next = lines[index + 1];
      if (!next || !next.trim()) break;
      const nextItem = LIST_ITEM.exec(next);
      const continues = (nextItem && nextItem[1].length >= baseIndent) || /^\s{2,}\S/.test(next);
      if (!continues) break;
      if (current) current.push('');
      index += 1;
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item && item[1].length === baseIndent && Boolean(item[3]) === ordered) {
      current = [item[4]];
      groups.push(current);
      index += 1;
      continue;
    }
    if (!current) break;
    if (item && item[1].length > baseIndent) {
      current.push(line.slice(Math.min(baseIndent + 2, line.length - line.trimStart().length + baseIndent)));
      index += 1;
      continue;
    }
    if (/^\s{2,}\S/.test(line) || (!item && line.trim())) {
      current.push(line.trim());
      index += 1;
      continue;
    }
    break;
  }
  return {
    list: { kind: 'list' as const, ordered, start, items: groups.map((group) => parseBlocks(group)) },
    nextIndex: index
  };
}

function trimBlankEdges(lines: string[]) {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start].trim()) start += 1;
  while (end > start && !lines[end - 1].trim()) end -= 1;
  return lines.slice(start, end);
}

export function parseInline(source: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let buffer = '';
  let index = 0;
  const flush = () => {
    if (buffer) {
      nodes.push({ kind: 'text', value: buffer });
      buffer = '';
    }
  };
  while (index < source.length) {
    const char = source[index];
    if (char === '\\' && index + 1 < source.length && PUNCTUATION.test(source[index + 1])) {
      buffer += source[index + 1];
      index += 2;
      continue;
    }
    if (char === '`') {
      const run = countRun(source, index, '`');
      const closing = findRun(source, index + run, '`', run);
      if (closing !== -1) {
        flush();
        nodes.push({ kind: 'code', value: normalizeCodeSpan(source.slice(index + run, closing)) });
        index = closing + run;
        continue;
      }
    }
    if (char === '[') {
      const link = matchLink(source, index);
      if (link) {
        flush();
        nodes.push({ kind: 'link', href: link.href, children: parseInline(link.text) });
        index = link.end;
        continue;
      }
    }
    if (char === '*') {
      const run = countRun(source, index, '*');
      if (run >= 2) {
        const strong = matchEmphasis(source, index, 2);
        if (strong) {
          flush();
          nodes.push({ kind: 'strong', children: parseInline(strong.text) });
          index = strong.end;
          continue;
        }
      }
      if (run === 1) {
        const emphasis = matchEmphasis(source, index, 1);
        if (emphasis) {
          flush();
          nodes.push({ kind: 'emphasis', children: parseInline(emphasis.text) });
          index = emphasis.end;
          continue;
        }
      }
    }
    buffer += char;
    index += 1;
  }
  flush();
  return nodes;
}

function countRun(source: string, index: number, char: string) {
  let run = 0;
  while (index + run < source.length && source[index + run] === char) run += 1;
  return run;
}

function findRun(source: string, from: number, char: string, length: number) {
  let index = from;
  while (index < source.length) {
    if (source[index] === char) {
      const run = countRun(source, index, char);
      if (run === length) return index;
      index += run;
      continue;
    }
    index += 1;
  }
  return -1;
}

function normalizeCodeSpan(value: string) {
  const collapsed = value.replace(/\n/g, ' ');
  if (collapsed.length > 2 && collapsed.startsWith(' ') && collapsed.endsWith(' ') && collapsed.trim()) {
    return collapsed.slice(1, -1);
  }
  return collapsed;
}

function matchEmphasis(source: string, start: number, width: number) {
  const opening = start + width;
  if (opening >= source.length || /\s/.test(source[opening])) return null;
  let index = opening;
  while (index < source.length) {
    if (source[index] === '`') {
      const run = countRun(source, index, '`');
      const closing = findRun(source, index + run, '`', run);
      index = closing === -1 ? index + run : closing + run;
      continue;
    }
    if (source[index] === '\\') {
      index += 2;
      continue;
    }
    if (source[index] === '*') {
      const run = countRun(source, index, '*');
      if (run >= width && !/\s/.test(source[index - 1])) {
        return { text: source.slice(opening, index), end: index + width };
      }
      index += run;
      continue;
    }
    index += 1;
  }
  return null;
}

function matchLink(source: string, start: number) {
  let index = start + 1;
  let depth = 1;
  while (index < source.length && depth > 0) {
    const char = source[index];
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === '[') depth += 1;
    if (char === ']') depth -= 1;
    if (depth === 0) break;
    index += 1;
  }
  if (depth !== 0 || source[index + 1] !== '(') return null;
  const text = source.slice(start + 1, index);
  let cursor = index + 2;
  let parens = 1;
  while (cursor < source.length && parens > 0) {
    const char = source[cursor];
    if (char === '\\') {
      cursor += 2;
      continue;
    }
    if (char === '(') parens += 1;
    if (char === ')') parens -= 1;
    if (parens === 0) break;
    cursor += 1;
  }
  if (parens !== 0) return null;
  const href = source.slice(index + 2, cursor).trim();
  if (!href) return null;
  return { text, href, end: cursor + 1 };
}
