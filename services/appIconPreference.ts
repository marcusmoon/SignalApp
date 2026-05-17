import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

export type AppIconVariant = 'blue' | 'green' | 'dark' | 'mono';

export const APP_ICON_VARIANTS: readonly {
  id: AppIconVariant;
  accent: string;
  background: string;
}[] = [
  { id: 'green', accent: '#03B26C', background: '#0A0A0F' },
  { id: 'blue', accent: '#3182F6', background: '#0A0A0F' },
  { id: 'dark', accent: '#4D9FFF', background: '#0A0A0F' },
  { id: 'mono', accent: '#F2F4F6', background: '#0A0A0F' },
];

const STORAGE_KEY = '@signal/app_icon_variant_v1';
const VALID = new Set<AppIconVariant>(APP_ICON_VARIANTS.map((item) => item.id));
const DEFAULT_APP_ICON_VARIANT: AppIconVariant = 'blue';

/** 기본(블루) = 번들 `icon.png`, 나머지는 alternate asset */
const IOS_ICON_NAME: Record<AppIconVariant, string | null> = {
  blue: null,
  green: 'SignalIconGreen',
  dark: 'SignalIconDark',
  mono: 'SignalIconMono',
};

type SignalAppIconNativeModule = {
  isSupported?: () => Promise<boolean>;
  getAlternateIconName?: () => Promise<string | null>;
  setAlternateIconName?: (iconName: string | null) => Promise<boolean>;
};

const SignalAppIcon = NativeModules.SignalAppIcon as SignalAppIconNativeModule | undefined;
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
  return v && VALID.has(v as AppIconVariant) ? (v as AppIconVariant) : DEFAULT_APP_ICON_VARIANT;
}

export async function saveAppIconVariant(variant: AppIconVariant): Promise<void> {
  const next = VALID.has(variant) ? variant : DEFAULT_APP_ICON_VARIANT;
  await applyNativeAppIconVariant(next);
  await AsyncStorage.setItem(STORAGE_KEY, next);
  notify();
}

export async function applyNativeAppIconVariant(variant: AppIconVariant): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  if (!SignalAppIcon?.setAlternateIconName) return false;
  try {
    const supported = SignalAppIcon.isSupported ? await SignalAppIcon.isSupported() : true;
    if (!supported) return false;
    const iconName = IOS_ICON_NAME[variant];
    const current = SignalAppIcon.getAlternateIconName
      ? await SignalAppIcon.getAlternateIconName()
      : null;
    if (current === iconName) return true;
    return Boolean(await SignalAppIcon.setAlternateIconName(iconName));
  } catch {
    return false;
  }
}

export async function syncStoredAppIconVariant(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored || !VALID.has(stored as AppIconVariant)) return false;
  return applyNativeAppIconVariant(stored as AppIconVariant);
}
