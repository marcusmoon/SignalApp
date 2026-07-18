import {
  MORE_HUB_ROUTE_ORDER_DEFAULT,
  type MoreHubRouteKey,
} from '@/constants/moreHubOrder';

const ALL_KEYS: MoreHubRouteKey[] = [...MORE_HUB_ROUTE_ORDER_DEFAULT];

function migrateHubKey(raw: unknown): MoreHubRouteKey | null {
  if (raw === 'todayBriefing') return 'disclosures';
  if (raw === 'settings') return null;
  if (ALL_KEYS.includes(raw as MoreHubRouteKey)) return raw as MoreHubRouteKey;
  return null;
}

export function normalizeMoreHubOrder(raw: unknown): MoreHubRouteKey[] {
  if (!Array.isArray(raw)) return [...MORE_HUB_ROUTE_ORDER_DEFAULT];
  if (!raw.includes('account') && !raw.includes('todayBriefing')) return [...MORE_HUB_ROUTE_ORDER_DEFAULT];
  const out: MoreHubRouteKey[] = [];
  const seen = new Set<MoreHubRouteKey>();
  for (const x of raw) {
    const key = migrateHubKey(x);
    if (key && !seen.has(key)) {
      out.push(key);
      seen.add(key);
    }
  }
  for (const k of MORE_HUB_ROUTE_ORDER_DEFAULT) {
    if (seen.has(k)) continue;
    // ETF는 게시판 바로 앞 (신규 키 마이그레이션)
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
