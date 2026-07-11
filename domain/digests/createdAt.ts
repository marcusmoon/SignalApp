import type { SignalApiDisclosureDigestItem, SignalApiNewsDigestItem } from '@/integrations/signal-api/types';

type DigestCreatedSourceRef = {
  publishedAt?: string | null;
  filedAt?: string | null;
};

type DigestCreatedFields = {
  generatedAt?: string | null;
  generatedDate?: string | null;
  sourceRefs?: DigestCreatedSourceRef[];
};

function noonUtcFromDateOnly(date: string): string | null {
  const text = String(date || '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00.000Z` : null;
}

export function newsDigestCreatedIso(item: DigestCreatedFields | SignalApiNewsDigestItem): string | null {
  const generated = String(item.generatedAt || '').trim();
  if (generated) return generated;
  const published = String(item.sourceRefs?.[0]?.publishedAt || '').trim();
  if (published) return published;
  return noonUtcFromDateOnly(String(item.generatedDate || ''));
}

export function disclosureDigestCreatedIso(
  item: DigestCreatedFields | SignalApiDisclosureDigestItem,
): string | null {
  const generated = String(item.generatedAt || '').trim();
  if (generated) return generated;
  const filed = String(item.sourceRefs?.[0]?.filedAt || '').trim();
  if (filed) return filed;
  return noonUtcFromDateOnly(String(item.generatedDate || ''));
}
