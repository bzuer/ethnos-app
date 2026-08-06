import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx';
import { buildAccessUrl, buildDoiUrl, normalizeIssue, normalizeValue, normWork } from './work-export';

function buildApaParagraph(work: any, fallbackAuthor: string, spacing: boolean): Paragraph | null {
  const typeRaw = (work?.work_type || work?.type || '').toString().toLowerCase();
  const isBook = typeRaw === 'book';
  const isArticle = typeRaw === 'article' || typeRaw === 'journal';
  const apaNames = (list: any) => (Array.isArray(list) ? list : []).map((item: any) => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    const family = item?.family_name || item?.name || '';
    const given = item?.given_names || '';
    const initials = given
      ? given.split(/\s+/).filter(Boolean).map((part: string) => part.charAt(0).toUpperCase() + '.').join(' ')
      : '';
    return family ? `${family}${initials ? `, ${initials}` : ''}` : (item?.preferred_name || '');
  }).filter(Boolean);
  const joinApaNames = (names: string[]) => {
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} & ${names[1]}`;
    if (names.length > 2) return `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`;
    return '';
  };
  const authors = apaNames(work?.authors);
  const editors = apaNames(work?.editors);
  const translators = apaNames(work?.translators);
  let authorText = joinApaNames(authors);
  if (!authorText && editors.length) authorText = `${joinApaNames(editors)} (${editors.length > 1 ? 'Eds.' : 'Ed.'})`;
  if (!authorText) authorText = fallbackAuthor;
  const editorNote = authorText && authors.length && editors.length
    ? `${joinApaNames(editors)} (${editors.length > 1 ? 'Eds.' : 'Ed.'})`
    : '';
  const translatorNote = translators.length ? `${joinApaNames(translators)}, Trans.` : '';
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
  if (titleText) children.push(new TextRun({ text: ` ${titleText}`, italics: isBook }));
  if (titleText && translatorNote) children.push(new TextRun({ text: ` (${translatorNote})` }));
  if (titleText) children.push(new TextRun({ text: '.' }));
  if (editorNote) children.push(new TextRun({ text: ` In ${editorNote},` }));
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
