import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/more_reference_links_visible_v1';

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

export function subscribeMoreReferenceLinksVisibilityChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadMoreReferenceLinksVisible(): Promise<boolean> {
  try {
    const s = await AsyncStorage.getItem(STORAGE_KEY);
    if (s == null) return true;
    return s === '1' || s === 'true';
  } catch {
    return true;
  }
}

export async function saveMoreReferenceLinksVisible(visible: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, visible ? '1' : '0');
  } catch {
    /* ignore */
  }
  notify();
}
