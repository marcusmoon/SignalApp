import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  parseBlockPuzzleProgress,
  parseMahjongProgress,
  parseSudokuProgress,
  parseSumTrailProgress,
  type BlockPuzzleProgress,
  type MahjongProgress,
  type SudokuProgress,
  type SumTrailProgress,
} from '@/domain/games/progress/parseGameProgress';
import type { BlockPuzzleState } from '@/domain/games/blockPuzzle';
import type { MahjongState } from '@/domain/games/mahjongSolitaire';
import type { SumTrailState } from '@/domain/games/sumTrail';
import type { SudokuState } from '@/domain/games/sudoku';

export type { BlockPuzzleProgress, MahjongProgress, SudokuProgress, SumTrailProgress };
export {
  parseBlockPuzzleProgress,
  parseMahjongProgress,
  parseSudokuProgress,
  parseSumTrailProgress,
};

const SUM_TRAIL_KEY = '@signal/game_progress_sum_trail_v1';
const SUDOKU_KEY = '@signal/game_progress_sudoku_v1';
const BLOCK_PUZZLE_KEY = '@signal/game_progress_block_puzzle_v1';
const MAHJONG_KEY = '@signal/game_progress_mahjong_v1';

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

export async function loadBlockPuzzleProgress(): Promise<BlockPuzzleProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(BLOCK_PUZZLE_KEY);
    if (raw == null) return null;
    return parseBlockPuzzleProgress(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export async function saveBlockPuzzleProgress(state: BlockPuzzleState): Promise<void> {
  if (state.status === 'gameover') {
    await clearBlockPuzzleProgress();
    return;
  }
  const payload: BlockPuzzleProgress = {
    updatedAt: new Date().toISOString(),
    difficulty: state.difficulty,
    state,
  };
  try {
    await AsyncStorage.setItem(BLOCK_PUZZLE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export async function clearBlockPuzzleProgress(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BLOCK_PUZZLE_KEY);
  } catch {
    /* ignore */
  }
}

export async function loadMahjongProgress(): Promise<MahjongProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(MAHJONG_KEY);
    if (raw == null) return null;
    return parseMahjongProgress(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export async function saveMahjongProgress(state: MahjongState, elapsedMs: number): Promise<void> {
  if (state.status === 'cleared') {
    await clearMahjongProgress();
    return;
  }
  const payload: MahjongProgress = {
    updatedAt: new Date().toISOString(),
    difficulty: state.difficulty,
    state,
    elapsedMs: Math.max(0, Math.floor(elapsedMs)),
  };
  try {
    await AsyncStorage.setItem(MAHJONG_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export async function clearMahjongProgress(): Promise<void> {
  try {
    await AsyncStorage.removeItem(MAHJONG_KEY);
  } catch {
    /* ignore */
  }
}

/** 허브 배지용 — 이어하기 가능 여부 */
export async function loadGameProgressSummaries(): Promise<{
  sumTrail: SumTrailProgress | null;
  sudoku: SudokuProgress | null;
  blockPuzzle: BlockPuzzleProgress | null;
  mahjong: MahjongProgress | null;
}> {
  const [sumTrail, sudoku, blockPuzzle, mahjong] = await Promise.all([
    loadSumTrailProgress(),
    loadSudokuProgress(),
    loadBlockPuzzleProgress(),
    loadMahjongProgress(),
  ]);
  return { sumTrail, sudoku, blockPuzzle, mahjong };
}
