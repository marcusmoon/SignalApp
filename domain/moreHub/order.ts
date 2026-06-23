import {
  MORE_HUB_ROUTE_ORDER_DEFAULT,
  type MoreHubRouteKey,
} from '@/constants/moreHubOrder';

const ALL_KEYS: MoreHubRouteKey[] = [...MORE_HUB_ROUTE_ORDER_DEFAULT];

function migrateHubKey(raw: unknown): MoreHubRouteKey | null {
  if (raw === 'todayBriefing') return 'disclosures';
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
    if (!seen.has(k)) out.push(k);
  }
  return out;
}
