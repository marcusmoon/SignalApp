import {
  digestSourceIconEntries,
  type SourceIconEntry,
} from '@/components/signal/SourceIconStack';
import type { StoredNotification } from '@/services/notificationHistory';

function cleanText(value: unknown): string {
  return String(value ?? '').trim();
}

function payloadRecord(item: StoredNotification): Record<string, unknown> {
  return item.payload && typeof item.payload === 'object' ? item.payload : {};
}

function sourceRefRows(payload: Record<string, unknown>): Array<{ sourceName?: string | null; url?: string | null }> {
  const rows = payload.sourceRefs;
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => row && typeof row === 'object') as Array<{
    sourceName?: string | null;
    url?: string | null;
  }>;
}

function sourceNameList(payload: Record<string, unknown>): string[] {
  const rows = payload.sources;
  if (!Array.isArray(rows)) return [];
  return rows.map((name) => cleanText(name)).filter(Boolean);
}

/** 알림 payload·타입에서 출처 아이콘 엔트리 추출 (없으면 빈 배열) */
export function notificationSourceIconEntries(item: StoredNotification): SourceIconEntry[] {
  const payload = payloadRecord(item);
  const fromRefs = sourceRefRows(payload);
  const fromNames = sourceNameList(payload);

  if (fromRefs.length > 0 || fromNames.length > 0) {
    return digestSourceIconEntries(fromRefs, fromNames);
  }

  return [];
}
