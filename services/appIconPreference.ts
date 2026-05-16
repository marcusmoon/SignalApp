import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppIconVariant = 'blue' | 'green' | 'dark' | 'mono';

export const APP_ICON_VARIANTS: readonly {
  id: AppIconVariant;
  accent: string;
  background: string;
}[] = [
  { id: 'blue', accent: '#3182F6', background: '#FFFFFF' },
  { id: 'green', accent: '#03B26C', background: '#FFFFFF' },
  { id: 'dark', accent: '#4D9FFF', background: '#0A0A0F' },
  { id: 'mono', accent: '#191F28', background: '#F2F4F6' },
];

const STORAGE_KEY = '@signal/app_icon_variant_v1';
const VALID = new Set<AppIconVariant>(APP_ICON_VARIANTS.map((item) => item.id));
type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeAppIconVariantChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadAppIconVariant(): Promise<AppIconVariant> {
  const v = await AsyncStorage.getItem(STORAGE_KEY);
  return v && VALID.has(v as AppIconVariant) ? (v as AppIconVariant) : 'blue';
}

export async function saveAppIconVariant(variant: AppIconVariant): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, VALID.has(variant) ? variant : 'blue');
  notify();
}
