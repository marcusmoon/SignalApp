import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeMoreHubOrder } from '@/domain/moreHub';
import {
  MORE_HUB_ROUTE_ORDER_DEFAULT,
  type MoreHubRouteKey,
} from '@/constants/moreHubOrder';

const STORAGE_KEY = '@signal/more_hub_order_v1';

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

export async function loadMoreHubOrder(): Promise<MoreHubRouteKey[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return [...MORE_HUB_ROUTE_ORDER_DEFAULT];
    return normalizeMoreHubOrder(JSON.parse(stored) as unknown);
  } catch {
    return [...MORE_HUB_ROUTE_ORDER_DEFAULT];
  }
}

export async function saveMoreHubOrder(order: MoreHubRouteKey[]): Promise<void> {
  const next = normalizeMoreHubOrder(order);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notify();
}
