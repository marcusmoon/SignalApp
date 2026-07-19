import type { SumTrailDifficulty, SumTrailState } from '../sumTrail/sumTrail.ts';
import type { SudokuDifficulty, SudokuState } from '../sudoku/sudoku.ts';

export type SumTrailProgress = {
  updatedAt: string;
  difficulty: SumTrailDifficulty;
  state: SumTrailState;
};

export type SudokuProgress = {
  updatedAt: string;
  difficulty: SudokuDifficulty;
  state: SudokuState;
  /** 누적 플레이 시간(ms) — 백그라운드 제외분 */
  elapsedMs: number;
};

function isDiff(v: unknown): v is 'easy' | 'normal' | 'hard' {
  return v === 'easy' || v === 'normal' || v === 'hard';
}

function isGrid(v: unknown, size?: number): v is number[][] {
  if (!Array.isArray(v) || v.length === 0) return false;
  if (size != null && v.length !== size) return false;
  return v.every(
    (row) =>
      Array.isArray(row) &&
      (size == null ? row.length === v.length : row.length === size) &&
      row.every((n) => typeof n === 'number' && Number.isFinite(n)),
  );
}

export function parseSumTrailProgress(raw: unknown): SumTrailProgress | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!isDiff(o.difficulty)) return null;
  const st = o.state;
  if (st == null || typeof st !== 'object') return null;
  const s = st as Record<string, unknown>;
  if (!isGrid(s.grid)) return null;
  if (typeof s.level !== 'number' || typeof s.score !== 'number') return null;
  if (typeof s.target !== 'number' || typeof s.clears !== 'number') return null;
  if (s.status !== 'playing' && s.status !== 'cleared' && s.status !== 'failed') return null;
  if (!isDiff(s.difficulty)) return null;
  const path = Array.isArray(s.path)
    ? s.path.filter(
        (c): c is { r: number; c: number } =>
          c != null &&
          typeof c === 'object' &&
          typeof (c as { r: unknown }).r === 'number' &&
          typeof (c as { c: unknown }).c === 'number',
      )
    : [];
  const hintCell =
    s.hintCell != null &&
    typeof s.hintCell === 'object' &&
    typeof (s.hintCell as { r: unknown }).r === 'number' &&
    typeof (s.hintCell as { c: unknown }).c === 'number'
      ? { r: (s.hintCell as { r: number }).r, c: (s.hintCell as { c: number }).c }
      : null;
  const state: SumTrailState = {
    level: Math.max(1, Math.floor(s.level)),
    difficulty: s.difficulty,
    grid: s.grid,
    target: Math.max(0, Math.floor(s.target)),
    path,
    clears: Math.max(0, Math.floor(s.clears)),
    clearsNeeded: typeof s.clearsNeeded === 'number' ? Math.max(1, Math.floor(s.clearsNeeded)) : 3,
    status: s.status,
    score: Math.max(0, Math.floor(s.score)),
    hintsRemaining:
      typeof s.hintsRemaining === 'number' ? Math.max(0, Math.floor(s.hintsRemaining)) : 0,
    hintCell,
  };
  return {
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString(),
    difficulty: o.difficulty,
    state,
  };
}

export function parseSudokuProgress(raw: unknown): SudokuProgress | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!isDiff(o.difficulty)) return null;
  const st = o.state;
  if (st == null || typeof st !== 'object') return null;
  const s = st as Record<string, unknown>;
  if (!isGrid(s.puzzle, 9) || !isGrid(s.solution, 9) || !isGrid(s.grid, 9)) return null;
  if (s.status !== 'playing' && s.status !== 'cleared') return null;
  if (!isDiff(s.difficulty)) return null;
  // cleared 진행분은 이어하기 대상이 아님
  if (s.status === 'cleared') return null;
  const selected =
    s.selected != null &&
    typeof s.selected === 'object' &&
    typeof (s.selected as { r: unknown }).r === 'number' &&
    typeof (s.selected as { c: unknown }).c === 'number'
      ? { r: (s.selected as { r: number }).r, c: (s.selected as { c: number }).c }
      : null;
  const history = Array.isArray(s.history)
    ? s.history
        .filter(
          (h): h is { cell: { r: number; c: number }; prev: number } =>
            h != null &&
            typeof h === 'object' &&
            typeof (h as { prev: unknown }).prev === 'number' &&
            (h as { cell: unknown }).cell != null &&
            typeof (h as { cell: { r: unknown } }).cell === 'object' &&
            typeof (h as { cell: { r: unknown } }).cell.r === 'number' &&
            typeof (h as { cell: { c: unknown } }).cell.c === 'number',
        )
        .map((h) => ({
          cell: { r: h.cell.r, c: h.cell.c },
          prev: h.prev,
        }))
    : [];
  const state: SudokuState = {
    difficulty: s.difficulty,
    puzzle: s.puzzle,
    solution: s.solution,
    grid: s.grid,
    selected,
    status: 'playing',
    mistakes: typeof s.mistakes === 'number' ? Math.max(0, Math.floor(s.mistakes)) : 0,
    hintsRemaining:
      typeof s.hintsRemaining === 'number' ? Math.max(0, Math.floor(s.hintsRemaining)) : 0,
    history,
  };
  return {
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString(),
    difficulty: o.difficulty,
    state,
    elapsedMs:
      typeof o.elapsedMs === 'number' && Number.isFinite(o.elapsedMs)
        ? Math.max(0, Math.floor(o.elapsedMs))
        : 0,
  };
}
