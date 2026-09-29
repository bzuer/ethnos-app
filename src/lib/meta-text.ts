export const TITLE_MAX_LENGTH = 70;
export const DESCRIPTION_MIN_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 160;

export type FittedTitle = string | { absolute: string };

export type DescriptionOptions = {
  min?: number;
  max?: number;
  fill?: 'min' | 'max';
  suffix?: string;
};

const ELLIPSIS = '…';
const SENTENCE_END = /[.!?…]["'”’)\]]?$/;
const TRAILING_JOINERS = /[\s,;:.!?\-–—(/]+$/;

export function collapseText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

export function endSentence(value: unknown): string {
  const text = collapseText(value);
  if (!text) return '';
  return SENTENCE_END.test(text) ? text : `${text}.`;
}

export function clampText(value: unknown, max: number): string {
  const text = collapseText(value);
  if (text.length <= max) return text;
  const room = Math.max(1, max - ELLIPSIS.length);
  const window = text.slice(0, room + 1);
  const boundary = window.lastIndexOf(' ');
  const head = boundary > room * 0.6 ? window.slice(0, boundary) : text.slice(0, room);
  return `${head.replace(TRAILING_JOINERS, '')}${ELLIPSIS}`;
}

export function summarizeText(value: unknown, max = DESCRIPTION_MAX_LENGTH, min = DESCRIPTION_MIN_LENGTH): string {
  const text = collapseText(value);
  if (text.length <= max) return text;
  let summary = '';
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const candidate = summary ? `${summary} ${sentence}` : sentence;
    if (candidate.length > max) break;
    summary = candidate;
  }
  return summary.length >= min ? summary : clampText(text, max);
}

export function composeDescription(lead: unknown, extras: unknown[] = [], options: DescriptionOptions = {}): string {
  const suffix = collapseText(options.suffix);
  const reserve = suffix ? suffix.length + 1 : 0;
  const max = (options.max ?? DESCRIPTION_MAX_LENGTH) - reserve;
  const min = Math.min(max, Math.max(0, (options.min ?? DESCRIPTION_MIN_LENGTH) - reserve));
  const target = options.fill === 'max' ? max : min;
  let description = summarizeText(lead, max, min);
  for (const extra of extras) {
    if (description.length >= target) break;
    const addition = collapseText(extra);
    if (!addition) continue;
    const candidate = description ? `${endSentence(description)} ${addition}` : addition;
    if (candidate.length <= max) description = candidate;
  }
  if (description.length > max) description = clampText(description, max);
  const finished = endSentence(description);
  if (finished.length <= max) description = finished;
  if (!suffix) return description;
  return description ? `${endSentence(description)} ${suffix}` : suffix;
}

export function fitTitle(
  template: string,
  candidates: unknown[],
  truncate?: { text: unknown; tail?: unknown },
  max = TITLE_MAX_LENGTH
): FittedTitle | undefined {
  const options = Array.from(new Set(candidates.map(collapseText).filter(Boolean)));
  const branded = (title: string) => (template.includes('%s') ? template.replace('%s', title) : title);
  for (const option of options) {
    if (branded(option).length <= max) return option;
    if (option.length <= max) return { absolute: option };
  }
  const text = collapseText(truncate?.text) || options[0];
  if (!text) return undefined;
  const tail = collapseText(truncate?.tail);
  return { absolute: tail ? `${clampText(text, max - tail.length - 1)} ${tail}` : clampText(text, max) };
}
