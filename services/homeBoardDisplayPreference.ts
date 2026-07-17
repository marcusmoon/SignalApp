import AsyncStorage from '@react-native-async-storage/async-storage';

import { COMMUNITY_SOURCES, type CommunitySourceKey } from '@/constants/communitySources';

const STORAGE_KEY_V1 = '@signal/home_board_display_count_v1';
const STORAGE_KEY = '@signal/home_board_display_counts_v2';

/** 게시판(출처)별 홈에 보여줄 최근 글 개수 */
export const HOME_BOARD_DISPLAY_DEFAULT = 2;
export const HOME_BOARD_DISPLAY_MIN = 1;
export const HOME_BOARD_DISPLAY_MAX = 5;

export type HomeBoardDisplayCounts = Record<CommunitySourceKey, number>;

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeHomeBoardDisplayCountChanged(listener: Listener): () => void {
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

function clamp(value: number): number {
  if (!Number.isFinite(value)) return HOME_BOARD_DISPLAY_DEFAULT;
  return Math.min(HOME_BOARD_DISPLAY_MAX, Math.max(HOME_BOARD_DISPLAY_MIN, Math.round(value)));
}

export function defaultHomeBoardDisplayCounts(): HomeBoardDisplayCounts {
  return {
    save_user_news: HOME_BOARD_DISPLAY_DEFAULT,
    naver_likeusstock_free: HOME_BOARD_DISPLAY_DEFAULT,
  };
}

function normalizeCounts(raw: unknown, fallbackPerSource?: number): HomeBoardDisplayCounts {
  const fallback = clamp(fallbackPerSource ?? HOME_BOARD_DISPLAY_DEFAULT);
  const base = defaultHomeBoardDisplayCounts();
  for (const source of COMMUNITY_SOURCES) {
    base[source] = fallback;
  }
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  for (const source of COMMUNITY_SOURCES) {
    if (obj[source] != null) base[source] = clamp(Number(obj[source]));
  }
  return base;
}

export async function loadHomeBoardDisplayCounts(): Promise<HomeBoardDisplayCounts> {
  try {
    const rawV2 = await AsyncStorage.getItem(STORAGE_KEY);
    if (rawV2 != null) {
      return normalizeCounts(JSON.parse(rawV2));
    }
    // v1: 단일 숫자를 모든 게시판에 동일 적용
    const rawV1 = await AsyncStorage.getItem(STORAGE_KEY_V1);
    if (rawV1 != null) {
      const legacy = clamp(Number(JSON.parse(rawV1)));
      const migrated = normalizeCounts(null, legacy);
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      } catch {
        /* ignore */
      }
      return migrated;
    }
    return defaultHomeBoardDisplayCounts();
  } catch {
    return defaultHomeBoardDisplayCounts();
  }
}

/** @deprecated use loadHomeBoardDisplayCounts — max across boards for simple callers */
export async function loadHomeBoardDisplayCount(): Promise<number> {
  const counts = await loadHomeBoardDisplayCounts();
  return Math.max(...COMMUNITY_SOURCES.map((source) => counts[source]));
}

export async function saveHomeBoardDisplayCounts(counts: HomeBoardDisplayCounts): Promise<void> {
  const next = normalizeCounts(counts);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  notify();
}

export async function saveHomeBoardDisplayCountForSource(
  source: CommunitySourceKey,
  value: number,
): Promise<HomeBoardDisplayCounts> {
  const current = await loadHomeBoardDisplayCounts();
  const next = { ...current, [source]: clamp(value) };
  await saveHomeBoardDisplayCounts(next);
  return next;
}
