/** 게임 통산 기록 — 순수 규칙 (AsyncStorage 페이로드 정규화) */

export type GameDifficulty = 'easy' | 'normal' | 'hard';

export type SumTrailDiffRecords = {
  bestScore: number;
  bestLevel: number;
  levelsCleared: number;
};

export type SumTrailRecords = {
  runsStarted: number;
  levelsCleared: number;
  bestScore: number;
  bestLevel: number;
  byDifficulty: Record<GameDifficulty, SumTrailDiffRecords>;
};

export type SudokuDiffRecords = {
  clears: number;
  /** 완주 최단 시간(ms). null = 아직 없음 */
  bestTimeMs: number | null;
  /** 완주 최소 실수. null = 아직 없음 */
  bestMistakes: number | null;
};

export type SudokuRecords = {
  runsStarted: number;
  clears: number;
  byDifficulty: Record<GameDifficulty, SudokuDiffRecords>;
};

export type BlockPuzzleDiffRecords = {
  bestScore: number;
  bestLines: number;
  bestLevel: number;
  gamesPlayed: number;
};

export type BlockPuzzleRecords = {
  runsStarted: number;
  bestScore: number;
  bestLines: number;
  byDifficulty: Record<GameDifficulty, BlockPuzzleDiffRecords>;
};

export type MahjongDiffRecords = {
  clears: number;
  bestTimeMs: number | null;
  bestScore: number | null;
};

export type MahjongRecords = {
  runsStarted: number;
  clears: number;
  bestScore: number;
  byDifficulty: Record<GameDifficulty, MahjongDiffRecords>;
};

export type GameRecordsState = {
  version: 1;
  sumTrail: SumTrailRecords;
  sudoku: SudokuRecords;
  blockPuzzle: BlockPuzzleRecords;
  mahjong: MahjongRecords;
};

const DIFFS: GameDifficulty[] = ['easy', 'normal', 'hard'];

function emptySumTrailDiff(): SumTrailDiffRecords {
  return { bestScore: 0, bestLevel: 0, levelsCleared: 0 };
}

function emptySudokuDiff(): SudokuDiffRecords {
  return { clears: 0, bestTimeMs: null, bestMistakes: null };
}

export function emptySumTrailRecords(): SumTrailRecords {
  return {
    runsStarted: 0,
    levelsCleared: 0,
    bestScore: 0,
    bestLevel: 0,
    byDifficulty: {
      easy: emptySumTrailDiff(),
      normal: emptySumTrailDiff(),
      hard: emptySumTrailDiff(),
    },
  };
}

export function emptySudokuRecords(): SudokuRecords {
  return {
    runsStarted: 0,
    clears: 0,
    byDifficulty: {
      easy: emptySudokuDiff(),
      normal: emptySudokuDiff(),
      hard: emptySudokuDiff(),
    },
  };
}

function emptyBlockPuzzleDiff(): BlockPuzzleDiffRecords {
  return { bestScore: 0, bestLines: 0, bestLevel: 0, gamesPlayed: 0 };
}

export function emptyBlockPuzzleRecords(): BlockPuzzleRecords {
  return {
    runsStarted: 0,
    bestScore: 0,
    bestLines: 0,
    byDifficulty: {
      easy: emptyBlockPuzzleDiff(),
      normal: emptyBlockPuzzleDiff(),
      hard: emptyBlockPuzzleDiff(),
    },
  };
}

function emptyMahjongDiff(): MahjongDiffRecords {
  return { clears: 0, bestTimeMs: null, bestScore: null };
}

export function emptyMahjongRecords(): MahjongRecords {
  return {
    runsStarted: 0,
    clears: 0,
    bestScore: 0,
    byDifficulty: {
      easy: emptyMahjongDiff(),
      normal: emptyMahjongDiff(),
      hard: emptyMahjongDiff(),
    },
  };
}

export function emptyGameRecords(): GameRecordsState {
  return {
    version: 1,
    sumTrail: emptySumTrailRecords(),
    sudoku: emptySudokuRecords(),
    blockPuzzle: emptyBlockPuzzleRecords(),
    mahjong: emptyMahjongRecords(),
  };
}

function asDifficulty(v: unknown): GameDifficulty | null {
  return v === 'easy' || v === 'normal' || v === 'hard' ? v : null;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : fallback;
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
  return Math.floor(v);
}

export function normalizeGameRecords(raw: unknown): GameRecordsState {
  const base = emptyGameRecords();
  if (raw == null || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;

  const st = o.sumTrail;
  if (st && typeof st === 'object') {
    const s = st as Record<string, unknown>;
    base.sumTrail.runsStarted = num(s.runsStarted);
    base.sumTrail.levelsCleared = num(s.levelsCleared);
    base.sumTrail.bestScore = num(s.bestScore);
    base.sumTrail.bestLevel = num(s.bestLevel);
    const by = s.byDifficulty;
    if (by && typeof by === 'object') {
      for (const d of DIFFS) {
        const row = (by as Record<string, unknown>)[d];
        if (row && typeof row === 'object') {
          const r = row as Record<string, unknown>;
          base.sumTrail.byDifficulty[d] = {
            bestScore: num(r.bestScore),
            bestLevel: num(r.bestLevel),
            levelsCleared: num(r.levelsCleared),
          };
        }
      }
    }
  }

  const su = o.sudoku;
  if (su && typeof su === 'object') {
    const s = su as Record<string, unknown>;
    base.sudoku.runsStarted = num(s.runsStarted);
    base.sudoku.clears = num(s.clears);
    const by = s.byDifficulty;
    if (by && typeof by === 'object') {
      for (const d of DIFFS) {
        const row = (by as Record<string, unknown>)[d];
        if (row && typeof row === 'object') {
          const r = row as Record<string, unknown>;
          base.sudoku.byDifficulty[d] = {
            clears: num(r.clears),
            bestTimeMs: numOrNull(r.bestTimeMs),
            bestMistakes: numOrNull(r.bestMistakes),
          };
        }
      }
    }
  }

  const bp = o.blockPuzzle;
  if (bp && typeof bp === 'object') {
    const b = bp as Record<string, unknown>;
    base.blockPuzzle.runsStarted = num(b.runsStarted);
    base.blockPuzzle.bestScore = num(b.bestScore);
    base.blockPuzzle.bestLines = num(b.bestLines);
    const by = b.byDifficulty;
    if (by && typeof by === 'object') {
      for (const d of DIFFS) {
        const row = (by as Record<string, unknown>)[d];
        if (row && typeof row === 'object') {
          const r = row as Record<string, unknown>;
          base.blockPuzzle.byDifficulty[d] = {
            bestScore: num(r.bestScore),
            bestLines: num(r.bestLines),
            bestLevel: num(r.bestLevel),
            gamesPlayed: num(r.gamesPlayed),
          };
        }
      }
    }
  }

  const mj = o.mahjong;
  if (mj && typeof mj === 'object') {
    const m = mj as Record<string, unknown>;
    base.mahjong.runsStarted = num(m.runsStarted);
    base.mahjong.clears = num(m.clears);
    base.mahjong.bestScore = num(m.bestScore);
    const by = m.byDifficulty;
    if (by && typeof by === 'object') {
      for (const d of DIFFS) {
        const row = (by as Record<string, unknown>)[d];
        if (row && typeof row === 'object') {
          const r = row as Record<string, unknown>;
          base.mahjong.byDifficulty[d] = {
            clears: num(r.clears),
            bestTimeMs: numOrNull(r.bestTimeMs),
            bestScore: numOrNull(r.bestScore),
          };
        }
      }
    }
  }

  return base;
}

export function recordSumTrailRunStarted(records: GameRecordsState): GameRecordsState {
  return {
    ...records,
    sumTrail: {
      ...records.sumTrail,
      runsStarted: records.sumTrail.runsStarted + 1,
    },
  };
}

export function recordSumTrailLevelCleared(
  records: GameRecordsState,
  difficulty: GameDifficulty,
  level: number,
  score: number,
): GameRecordsState {
  const st = records.sumTrail;
  const diff = st.byDifficulty[difficulty];
  const nextDiff: SumTrailDiffRecords = {
    bestScore: Math.max(diff.bestScore, score),
    bestLevel: Math.max(diff.bestLevel, level),
    levelsCleared: diff.levelsCleared + 1,
  };
  return {
    ...records,
    sumTrail: {
      runsStarted: st.runsStarted,
      levelsCleared: st.levelsCleared + 1,
      bestScore: Math.max(st.bestScore, score),
      bestLevel: Math.max(st.bestLevel, level),
      byDifficulty: { ...st.byDifficulty, [difficulty]: nextDiff },
    },
  };
}

export function recordSudokuRunStarted(records: GameRecordsState): GameRecordsState {
  return {
    ...records,
    sudoku: {
      ...records.sudoku,
      runsStarted: records.sudoku.runsStarted + 1,
    },
  };
}

export function recordSudokuCleared(
  records: GameRecordsState,
  difficulty: GameDifficulty,
  elapsedMs: number,
  mistakes: number,
): GameRecordsState {
  const su = records.sudoku;
  const diff = su.byDifficulty[difficulty];
  const time = Math.max(0, Math.floor(elapsedMs));
  const miss = Math.max(0, Math.floor(mistakes));
  const nextDiff: SudokuDiffRecords = {
    clears: diff.clears + 1,
    bestTimeMs: diff.bestTimeMs == null ? time : Math.min(diff.bestTimeMs, time),
    bestMistakes: diff.bestMistakes == null ? miss : Math.min(diff.bestMistakes, miss),
  };
  return {
    ...records,
    sudoku: {
      runsStarted: su.runsStarted,
      clears: su.clears + 1,
      byDifficulty: { ...su.byDifficulty, [difficulty]: nextDiff },
    },
  };
}

export function recordBlockPuzzleRunStarted(records: GameRecordsState): GameRecordsState {
  return {
    ...records,
    blockPuzzle: {
      ...records.blockPuzzle,
      runsStarted: records.blockPuzzle.runsStarted + 1,
    },
  };
}

export function recordBlockPuzzleGameOver(
  records: GameRecordsState,
  difficulty: GameDifficulty,
  score: number,
  lines: number,
  level: number,
): GameRecordsState {
  const bp = records.blockPuzzle;
  const diff = bp.byDifficulty[difficulty];
  const sc = Math.max(0, Math.floor(score));
  const ln = Math.max(0, Math.floor(lines));
  const lv = Math.max(1, Math.floor(level));
  const nextDiff: BlockPuzzleDiffRecords = {
    bestScore: Math.max(diff.bestScore, sc),
    bestLines: Math.max(diff.bestLines, ln),
    bestLevel: Math.max(diff.bestLevel, lv),
    gamesPlayed: diff.gamesPlayed + 1,
  };
  return {
    ...records,
    blockPuzzle: {
      runsStarted: bp.runsStarted,
      bestScore: Math.max(bp.bestScore, sc),
      bestLines: Math.max(bp.bestLines, ln),
      byDifficulty: { ...bp.byDifficulty, [difficulty]: nextDiff },
    },
  };
}

export function recordMahjongRunStarted(records: GameRecordsState): GameRecordsState {
  return {
    ...records,
    mahjong: {
      ...records.mahjong,
      runsStarted: records.mahjong.runsStarted + 1,
    },
  };
}

export function recordMahjongCleared(
  records: GameRecordsState,
  difficulty: GameDifficulty,
  elapsedMs: number,
  score: number,
): GameRecordsState {
  const mj = records.mahjong;
  const diff = mj.byDifficulty[difficulty];
  const time = Math.max(0, Math.floor(elapsedMs));
  const sc = Math.max(0, Math.floor(score));
  const nextDiff: MahjongDiffRecords = {
    clears: diff.clears + 1,
    bestTimeMs: diff.bestTimeMs == null ? time : Math.min(diff.bestTimeMs, time),
    bestScore: diff.bestScore == null ? sc : Math.max(diff.bestScore, sc),
  };
  return {
    ...records,
    mahjong: {
      runsStarted: mj.runsStarted,
      clears: mj.clears + 1,
      bestScore: Math.max(mj.bestScore, sc),
      byDifficulty: { ...mj.byDifficulty, [difficulty]: nextDiff },
    },
  };
}

/** mm:ss 또는 h:mm:ss */
export function formatDurationMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function parseDifficulty(v: unknown): GameDifficulty | null {
  return asDifficulty(v);
}
