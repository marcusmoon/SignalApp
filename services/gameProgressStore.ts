import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  parseSudokuProgress,
  parseSumTrailProgress,
  type SudokuProgress,
  type SumTrailProgress,
} from '@/domain/games/progress/parseGameProgress';
import type { SumTrailState } from '@/domain/games/sumTrail';
import type { SudokuState } from '@/domain/games/sudoku';

export type { SudokuProgress, SumTrailProgress };
export { parseSudokuProgress, parseSumTrailProgress };

const SUM_TRAIL_KEY = '@signal/game_progress_sum_trail_v1';
const SUDOKU_KEY = '@signal/game_progress_sudoku_v1';

export async function loadSumTrailProgress(): Promise<SumTrailProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(SUM_TRAIL_KEY);
    if (raw == null) return null;
    return parseSumTrailProgress(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export async function saveSumTrailProgress(state: SumTrailState): Promise<void> {
  const payload: SumTrailProgress = {
    updatedAt: new Date().toISOString(),
    difficulty: state.difficulty,
    state,
  };
  try {
    await AsyncStorage.setItem(SUM_TRAIL_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export async function clearSumTrailProgress(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SUM_TRAIL_KEY);
  } catch {
    /* ignore */
  }
}

export async function loadSudokuProgress(): Promise<SudokuProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(SUDOKU_KEY);
    if (raw == null) return null;
    return parseSudokuProgress(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export async function saveSudokuProgress(state: SudokuState, elapsedMs: number): Promise<void> {
  if (state.status === 'cleared') {
    await clearSudokuProgress();
    return;
  }
  const payload: SudokuProgress = {
    updatedAt: new Date().toISOString(),
    difficulty: state.difficulty,
    state,
    elapsedMs: Math.max(0, Math.floor(elapsedMs)),
  };
  try {
    await AsyncStorage.setItem(SUDOKU_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export async function clearSudokuProgress(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SUDOKU_KEY);
  } catch {
    /* ignore */
  }
}

/** 허브 배지용 — 이어하기 가능 여부 */
export async function loadGameProgressSummaries(): Promise<{
  sumTrail: SumTrailProgress | null;
  sudoku: SudokuProgress | null;
}> {
  const [sumTrail, sudoku] = await Promise.all([loadSumTrailProgress(), loadSudokuProgress()]);
  return { sumTrail, sudoku };
}
