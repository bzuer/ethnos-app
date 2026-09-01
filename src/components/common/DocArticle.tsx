import { Fragment, type ReactNode } from 'react';
import LocaleLink from '@/components/common/LocaleLink';
import type { BlockNode, InlineNode, TableAlignment } from '@/lib/markdown';

type Props = {
  blocks: BlockNode[];
  lang?: string;
};

const ALIGNMENT_CLASS: Record<TableAlignment, string> = {
  left: '',
  center: ' doc-cell-center',
  right: ' doc-cell-right'
};

const HEADING_CLASS: Record<number, string> = {
  2: 'doc-heading doc-heading-2',
  3: 'doc-heading doc-heading-3',
  4: 'doc-heading doc-heading-4'
};

export default function DocArticle({ blocks, lang }: Props) {
  return (
    <div className="doc-body" lang={lang}>
      {renderBlocks(blocks, 'doc')}
    </div>
  );
}

function renderBlocks(blocks: BlockNode[], keyPrefix: string): ReactNode {
  return blocks.map((block, index) => renderBlock(block, `${keyPrefix}-${index}`));
}

function renderBlock(block: BlockNode, key: string): ReactNode {
  if (block.kind === 'heading') {
    const level = Math.min(Math.max(block.level, 2), 4);
    const Tag = (level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4') as 'h2' | 'h3' | 'h4';
    return (
      <Tag key={key} id={block.id} className={HEADING_CLASS[level]}>
        {block.ordinal ? <span className="doc-heading-number">{block.ordinal}</span> : null}
        {renderInline(block.children, key)}
      </Tag>
    );
  }
  if (block.kind === 'paragraph') {
    return <p key={key} className="doc-paragraph">{renderInline(block.children, key)}</p>;
  }
  if (block.kind === 'list') {
    const items = block.items.map((item, index) => (
      <li key={`${key}-i${index}`} className="doc-list-item">{renderListItem(item, `${key}-i${index}`)}</li>
    ));
    if (block.ordered) {
      return <ol key={key} className="doc-list doc-list-ordered" start={block.start}>{items}</ol>;
    }
    return <ul key={key} className="doc-list">{items}</ul>;
  }
  if (block.kind === 'table') {
    return (
      <div key={key} className="doc-table-scroll">
        <table className="data-table doc-table">
          <thead>
            <tr>
              {block.head.map((cell, index) => (
                <th key={`${key}-h${index}`} scope="col" className={`doc-cell${ALIGNMENT_CLASS[block.alignment[index] ?? 'left']}`}>
                  {renderInline(cell, `${key}-h${index}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={`${key}-r${rowIndex}`}>
                {row.map((cell, index) => (
                  <td key={`${key}-r${rowIndex}c${index}`} className={`doc-cell${ALIGNMENT_CLASS[block.alignment[index] ?? 'left']}`}>
                    {renderInline(cell, `${key}-r${rowIndex}c${index}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.kind === 'code') {
    return (
      <pre key={key} className="doc-code" tabIndex={0}>
        <code>{block.value}</code>
      </pre>
    );
  }
  if (block.kind === 'quote') {
    return <blockquote key={key} className="doc-quote">{renderBlocks(block.children, key)}</blockquote>;
  }
  if (block.kind === 'rule') {
    return <hr key={key} className="doc-rule" />;
  }
  return <span key={key} id={block.id} className="doc-anchor" />;
}

function renderListItem(blocks: BlockNode[], key: string): ReactNode {
  if (blocks.length === 1 && blocks[0].kind === 'paragraph') return renderInline(blocks[0].children, key);
  return renderBlocks(blocks, key);
}

function renderInline(nodes: InlineNode[], keyPrefix: string): ReactNode {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-n${index}`;
    if (node.kind === 'text') return <Fragment key={key}>{node.value}</Fragment>;
    if (node.kind === 'code') return <code key={key} className="doc-code-inline">{node.value}</code>;
    if (node.kind === 'strong') return <strong key={key} className="doc-strong">{renderInline(node.children, key)}</strong>;
    if (node.kind === 'emphasis') return <em key={key}>{renderInline(node.children, key)}</em>;
    return <DocLink key={key} href={node.href}>{renderInline(node.children, key)}</DocLink>;
  });
}

function DocLink({ href, children }: { href: string; children: ReactNode }) {
  if (href.startsWith('#')) {
    return <a className="doc-link" href={href}>{children}</a>;
  }
  if (/^(https?:|mailto:|tel:)/i.test(href)) {
    return <a className="doc-link" href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
  }
  return <LocaleLink className="doc-link" href={href}>{children}</LocaleLink>;
}
