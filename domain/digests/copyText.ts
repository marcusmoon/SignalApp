/** 다이제스트 제목·요약 → 클립보드용 평문 (순수). */

export function formatDigestCopyText(input: {
  title?: string | null;
  summary?: string | null;
}): string {
  const title = String(input.title || '').trim();
  const summary = String(input.summary || '').trim();
  if (!title && !summary) return '';
  if (!summary || summary === title) return title;
  if (!title) return summary;
  return `${title}\n\n${summary}`;
}
