/**
 * More 허브 타일 순서 정규화 — ETF를 게시판 앞에 삽입 · 레거시 키 마이그레이션.
 */

export type MoreHubRouteKeyNormalized = 'account' | 'disclosures' | 'etfBriefing' | 'board';

export const MORE_HUB_ROUTE_ORDER_DEFAULT_NORMALIZED: MoreHubRouteKeyNormalized[] = [
  'account',
  'disclosures',
  'etfBriefing',
  'board',
];

function migrateHubKey(raw: unknown): MoreHubRouteKeyNormalized | null {
  if (raw === 'todayBriefing') return 'disclosures';
  if (raw === 'settings') return null;
  if (
    raw === 'account' ||
    raw === 'disclosures' ||
    raw === 'etfBriefing' ||
    raw === 'board'
  ) {
    return raw;
  }
  return null;
}

export function normalizeMoreHubOrderRaw(raw: unknown): MoreHubRouteKeyNormalized[] {
  const defaults = MORE_HUB_ROUTE_ORDER_DEFAULT_NORMALIZED;
  if (!Array.isArray(raw)) return [...defaults];
  if (!raw.includes('account') && !raw.includes('todayBriefing')) return [...defaults];
  const out: MoreHubRouteKeyNormalized[] = [];
  const seen = new Set<MoreHubRouteKeyNormalized>();
  for (const x of raw) {
    const key = migrateHubKey(x);
    if (key && !seen.has(key)) {
      out.push(key);
      seen.add(key);
    }
  }
  for (const k of defaults) {
    if (seen.has(k)) continue;
    if (k === 'etfBriefing') {
      const boardIdx = out.indexOf('board');
      if (boardIdx >= 0) out.splice(boardIdx, 0, k);
      else out.push(k);
      seen.add(k);
      continue;
    }
    out.push(k);
    seen.add(k);
  }
  return out;
}
