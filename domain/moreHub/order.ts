import type { MoreHubRouteKey } from '@/constants/moreHubOrder';
import { normalizeMoreHubOrderRaw } from '@/domain/moreHub/normalizeMoreHubOrder';

export function normalizeMoreHubOrder(raw: unknown): MoreHubRouteKey[] {
  return normalizeMoreHubOrderRaw(raw) as MoreHubRouteKey[];
}
