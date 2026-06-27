import AsyncStorage from '@react-native-async-storage/async-storage';

export type HomeVariant = 'classic' | 'focus';

export const HOME_VARIANT_ORDER: HomeVariant[] = ['classic', 'focus'];

const STORAGE_KEY = '@signal/home_variant_v1';
const VALID = new Set<HomeVariant>(HOME_VARIANT_ORDER);

let cachedHomeVariant: HomeVariant | null = null;
const listeners = new Set<() => void>();

function normalizeHomeVariant(raw: string | null): HomeVariant {
  return raw && VALID.has(raw as HomeVariant) ? (raw as HomeVariant) : 'classic';
}

export function subscribeHomeVariantChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyHomeVariantChanged() {
  for (const listener of listeners) listener();
}

export async function loadHomeVariant(): Promise<HomeVariant> {
  if (cachedHomeVariant) return cachedHomeVariant;
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const next = normalizeHomeVariant(raw);
  cachedHomeVariant = next;
  return next;
}

export async function saveHomeVariant(value: HomeVariant): Promise<void> {
  const next = VALID.has(value) ? value : 'classic';
  cachedHomeVariant = next;
  await AsyncStorage.setItem(STORAGE_KEY, next);
  notifyHomeVariantChanged();
}
