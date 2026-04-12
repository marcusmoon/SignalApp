import {
  MORE_HUB_ROUTE_ORDER_DEFAULT,
  type MoreHubRouteKey,
} from '@/constants/moreHubOrder';

const ALL_KEYS: MoreHubRouteKey[] = [...MORE_HUB_ROUTE_ORDER_DEFAULT];

export function normalizeMoreHubOrder(raw: unknown): MoreHubRouteKey[] {
  if (!Array.isArray(raw)) return [...MORE_HUB_ROUTE_ORDER_DEFAULT];
  const out: MoreHubRouteKey[] = [];
  const seen = new Set<MoreHubRouteKey>();
  for (const x of raw) {
    if (ALL_KEYS.includes(x as MoreHubRouteKey) && !seen.has(x as MoreHubRouteKey)) {
      out.push(x as MoreHubRouteKey);
      seen.add(x as MoreHubRouteKey);
    }
  }
  for (const k of MORE_HUB_ROUTE_ORDER_DEFAULT) {
    if (!seen.has(k)) out.push(k);
  }
  return out;
}
