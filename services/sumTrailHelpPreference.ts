import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/sum_trail_help_mode_v1';

/** 합 트레일 설명 밴드: 펼침 / 접힘 / 숨김 */
export type SumTrailHelpMode = 'expanded' | 'collapsed' | 'hidden';

/** 폰·세로 스택 기본: 접힘 (보드 우선) */
export const SUM_TRAIL_HELP_DEFAULT: SumTrailHelpMode = 'collapsed';

const MODES = new Set<SumTrailHelpMode>(['expanded', 'collapsed', 'hidden']);

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeSumTrailHelpModeChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

function parseMode(raw: string | null): SumTrailHelpMode {
  if (raw == null) return SUM_TRAIL_HELP_DEFAULT;
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v === 'string' && MODES.has(v as SumTrailHelpMode)) {
      return v as SumTrailHelpMode;
    }
  } catch {
    /* ignore */
  }
  return SUM_TRAIL_HELP_DEFAULT;
}

export async function loadSumTrailHelpMode(): Promise<SumTrailHelpMode> {
  try {
    return parseMode(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return SUM_TRAIL_HELP_DEFAULT;
  }
}

export async function saveSumTrailHelpMode(mode: SumTrailHelpMode): Promise<void> {
  const next = MODES.has(mode) ? mode : SUM_TRAIL_HELP_DEFAULT;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notify();
}
