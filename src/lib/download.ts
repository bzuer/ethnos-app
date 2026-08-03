export const EXPORT_MIME = {
  json: 'application/json',
  bibtex: 'application/x-bibtex',
  ris: 'application/x-research-info-systems',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  text: 'text/plain;charset=utf-8'
} as const;

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function downloadText(filename: string, content: string, type: string = EXPORT_MIME.text) {
  downloadBlob(filename, new Blob([content || ' '], { type }));
}

export function downloadJson(filename: string, payload: any) {
  downloadText(filename, JSON.stringify(payload, null, 2), EXPORT_MIME.json);
}
