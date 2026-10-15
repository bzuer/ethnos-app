export function subjectTerm(subject: any, locale: string): string {
  if (locale === 'pt' && subject?.term_pt) return String(subject.term_pt);
  if (locale === 'es' && subject?.term_es) return String(subject.term_es);
  return subject?.term || '';
}

export function normalizeSubjectWorkItem(raw: any): any {
  return { ...raw, type: raw?.document_type ?? null };
}
