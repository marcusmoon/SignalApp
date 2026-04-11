import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/llm_provider_v1';

export type LlmProviderId = 'claude' | 'openai';

const DEFAULT_PROVIDER: LlmProviderId = 'claude';

const listeners = new Set<() => void>();

export async function loadLlmProvider(): Promise<LlmProviderId> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === 'openai' || raw === 'claude') return raw;
    return DEFAULT_PROVIDER;
  } catch {
    return DEFAULT_PROVIDER;
  }
}

export async function saveLlmProvider(id: LlmProviderId): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, id);
  listeners.forEach((fn) => {
    fn();
  });
}

export function subscribeLlmProviderChanged(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
