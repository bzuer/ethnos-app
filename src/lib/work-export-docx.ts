import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx';
import { buildAccessUrl, buildDoiUrl, normalizeIssue, normalizeValue, normWork } from './work-export';

function buildApaParagraph(work: any, fallbackAuthor: string, spacing: boolean): Paragraph | null {
  const typeRaw = (work?.work_type || work?.type || '').toString().toLowerCase();
  const isBook = typeRaw === 'book';
  const isArticle = typeRaw === 'article' || typeRaw === 'journal';
  const authors = Array.isArray(work?.authors) ? work.authors.map((item: any) => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    const family = item?.family_name || item?.name || '';
    const given = item?.given_names || '';
    const initials = given
      ? given.split(/\s+/).filter(Boolean).map((part: string) => part.charAt(0).toUpperCase() + '.').join(' ')
      : '';
    const name = family ? `${family}${initials ? `, ${initials}` : ''}` : (item?.preferred_name || '');
    return name;
  }).filter(Boolean) : [];
  let authorText = '';
  if (authors.length === 1) authorText = authors[0];
  else if (authors.length === 2) authorText = `${authors[0]} & ${authors[1]}`;
  else if (authors.length > 2) authorText = `${authors.slice(0, -1).join(', ')}, & ${authors[authors.length - 1]}`;
  if (!authorText) authorText = fallbackAuthor;
  const year = work?.publication?.year || work?.publication_year || work?.year || '';
  const title = normalizeValue(work?.title);
  const subtitle = normalizeValue(work?.subtitle);
  const titleText = title ? `${title}${subtitle ? `: ${subtitle}` : ''}` : '';
  const venue = work?.venue?.name || work?.venue_name || '';
  const volume = work?.publication?.volume || '';
  const issue = normalizeIssue(work?.publication?.issue || '');
  const pages = work?.publication?.pages || '';
  const publisher = work?.publisher?.name || work?.publisher_name || '';
  const isbn = work?.isbn || '';
  const doiUrl = buildDoiUrl(work?.doi || work?.publication?.doi);
  const accessUrl = work?.url || buildAccessUrl(work?.id);
  const children: TextRun[] = [];
  if (authorText) children.push(new TextRun({ text: authorText }));
  if (year) children.push(new TextRun({ text: ` (${year}).` }));
  if (titleText) children.push(new TextRun({ text: ` ${titleText}.`, italics: isBook }));
  if (isArticle && venue) {
    children.push(new TextRun({ text: ` ${venue}`, italics: true }));
    if (volume) children.push(new TextRun({ text: `, ${volume}`, italics: true }));
    if (issue) children.push(new TextRun({ text: `(${issue})` }));
    if (pages) children.push(new TextRun({ text: `, ${pages}` }));
    children.push(new TextRun({ text: '.' }));
  } else {
    if (venue) children.push(new TextRun({ text: ` ${venue}.`, italics: true }));
    if (publisher) children.push(new TextRun({ text: ` ${publisher}.` }));
    if (volume || issue || pages) {
      const volIssue = `${volume ? ` ${volume}` : ''}${issue ? `(${issue})` : ''}`;
      if (volIssue.trim()) children.push(new TextRun({ text: volIssue, italics: true }));
      if (pages) children.push(new TextRun({ text: `${volIssue.trim() ? ', ' : ' '}${pages}.` }));
      else if (volIssue.trim()) children.push(new TextRun({ text: '.' }));
    }
  }
  if (isbn) children.push(new TextRun({ text: ` ISBN: ${isbn}.` }));
  const oaUrl = work?.oa_url ? String(work.oa_url) : '';
  if (doiUrl) children.push(new TextRun({ text: ` ${doiUrl}` }));
  else if (accessUrl) children.push(new TextRun({ text: ` ${accessUrl}` }));
  if (oaUrl && oaUrl !== doiUrl && oaUrl !== accessUrl) children.push(new TextRun({ text: ` ${oaUrl}` }));
  if (!children.length) return null;
  return new Paragraph({ children, ...(spacing ? { spacing: { after: 240 } } : {}), alignment: AlignmentType.JUSTIFIED });
}

export async function buildApaDocxBlob(works: any[], fallbackAuthor: string, options?: { spacing?: boolean }): Promise<Blob> {
  const spacing = !!options?.spacing;
  const paragraphs = works
    .map((work) => {
      const nw = normWork(work);
      return nw ? buildApaParagraph(nw, fallbackAuthor, spacing) : null;
    })
    .filter((p): p is Paragraph => !!p);
  const doc = new Document({ sections: [{ children: paragraphs.length ? paragraphs : [new Paragraph(' ')] }] });
  return Packer.toBlob(doc);
}
