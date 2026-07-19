/**
 * 브리핑·인사이트 단건 표시용 발행 instant 선택.
 * format 의존 없이 ISO만 고른다 (상세 시간 메타 회귀용).
 */

export type BriefingInstantFields = {
  publishedAt?: string | null;
  generatedAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  briefingDate?: string | null;
  insightDate?: string | null;
};

function noonUtcFromDateOnly(date: string | null | undefined): string | null {
  const text = String(date || '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00.000Z` : null;
}

/** publishedAt → generatedAt → updatedAt → createdAt → date-only noon UTC */
export function briefingDetailPublishedIso(
  item: BriefingInstantFields | null | undefined,
): string | null {
  if (!item) return null;
  for (const raw of [item.publishedAt, item.generatedAt, item.updatedAt, item.createdAt]) {
    const value = String(raw || '').trim();
    if (value) return value;
  }
  return noonUtcFromDateOnly(item.briefingDate) ?? noonUtcFromDateOnly(item.insightDate);
}
