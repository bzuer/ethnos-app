export function normalizeSubject(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    ...raw,
    id: raw.id ?? raw.subject_id ?? null,
    term: raw.term || raw.display_name || raw.name || '',
    term_pt: raw.term_pt || null,
    term_es: raw.term_es || null,
    vocabulary: raw.vocabulary || null,
    subject_type: raw.subject_type || null,
    works_count: Number(raw.works_count) || 0,
    courses_count: Number(raw.courses_count) || 0,
    children_count: Number(raw.children_count) || 0,
    parent_id: raw.parent_id ?? null,
    parent_term: raw.parent_term || null,
    parent_vocabulary: raw.parent_vocabulary || null,
    avg_relevance_score: raw.avg_relevance_score ?? null
  };
}

export function subjectTerm(subject: any, locale: string): string {
  if (!subject) return '';
  if (locale === 'pt' && subject.term_pt) return String(subject.term_pt);
  if (locale === 'es' && subject.term_es) return String(subject.term_es);
  return subject.term || subject.display_name || subject.name || '';
}

export function normalizeSubjectWorkItem(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    ...raw,
    id: raw.id ?? raw.work_id ?? null,
    title: raw.title || '',
    publication_year: raw.publication_year ?? raw.year ?? null,
    type: raw.document_type || raw.type || raw.work_type || null,
    language: raw.language || null
  };
}
