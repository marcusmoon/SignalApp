import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  MORE_HUB_ROUTE_ORDER_DEFAULT,
  type MoreHubRouteKey,
} from '@/constants/moreHubOrder';

const STORAGE_KEY = '@signal/more_hub_order_v1';

const ALL_KEYS: MoreHubRouteKey[] = [...MORE_HUB_ROUTE_ORDER_DEFAULT];

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

export function subscribeMoreHubOrderChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function normalizeOrder(raw: unknown): MoreHubRouteKey[] {
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

export async function loadMoreHubOrder(): Promise<MoreHubRouteKey[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return [...MORE_HUB_ROUTE_ORDER_DEFAULT];
    return normalizeOrder(JSON.parse(stored) as unknown);
  } catch {
    return [...MORE_HUB_ROUTE_ORDER_DEFAULT];
  }
}

export async function saveMoreHubOrder(order: MoreHubRouteKey[]): Promise<void> {
  const next = normalizeOrder(order);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notify();
}
