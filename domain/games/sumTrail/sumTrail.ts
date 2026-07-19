/** 합 트레일 — 격자 경로 합 퍼즐 로직 */

/** 합 트레일 — 격자 칸 좌표 */
export type SumTrailCell = { r: number; c: number };

/** 0 = 빈 칸, 1~9 = 숫자 */
export type SumTrailGrid = number[][];

export type SumTrailDifficulty = 'easy' | 'normal' | 'hard';

export type SumTrailLevelConfig = {
  size: number;
  minPathLen: number;
  maxPathLen: number;
  clearsToClearLevel: number;
};

export type SumTrailStatus = 'playing' | 'cleared' | 'failed';

export type SumTrailState = {
  level: number;
  difficulty: SumTrailDifficulty;
  grid: SumTrailGrid;
  target: number;
  path: SumTrailCell[];
  clears: number;
  clearsNeeded: number;
  status: SumTrailStatus;
  score: number;
};


export function levelConfig(level: number, difficulty: SumTrailDifficulty): SumTrailLevelConfig {
  const baseSize = difficulty === 'hard' ? 5 : 4;
  const size = level >= 5 && difficulty !== 'easy' ? Math.min(6, baseSize + 1) : baseSize;
  const minPathLen = difficulty === 'easy' ? 3 : difficulty === 'normal' ? 3 : 4;
  const maxPathLen = Math.min(
    size * size,
    difficulty === 'easy' ? 4 : difficulty === 'normal' ? 5 : 6,
  );
  const clearsToClearLevel = difficulty === 'easy' ? 3 : difficulty === 'normal' ? 4 : 5;
  return { size, minPathLen, maxPathLen, clearsToClearLevel };
}

export function emptyGrid(size: number): SumTrailGrid {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
}

export function cloneGrid(grid: SumTrailGrid): SumTrailGrid {
  return grid.map((row) => [...row]);
}

export function gridSize(grid: SumTrailGrid): number {
  return grid.length;
}

export function cellKey(cell: SumTrailCell): string {
  return `${cell.r},${cell.c}`;
}

export function cellsEqual(a: SumTrailCell, b: SumTrailCell): boolean {
  return a.r === b.r && a.c === b.c;
}

export function isInBounds(grid: SumTrailGrid, cell: SumTrailCell): boolean {
  const n = gridSize(grid);
  return cell.r >= 0 && cell.c >= 0 && cell.r < n && cell.c < n;
}

export function isAdjacent(a: SumTrailCell, b: SumTrailCell): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

export function pathSum(grid: SumTrailGrid, path: SumTrailCell[]): number {
  let sum = 0;
  for (const cell of path) {
    sum += grid[cell.r]?.[cell.c] ?? 0;
  }
  return sum;
}

export function countFilled(grid: SumTrailGrid): number {
  let n = 0;
  for (const row of grid) {
    for (const v of row) {
      if (v > 0) n += 1;
    }
  }
  return n;
}

export function orthogonalNeighbors(grid: SumTrailGrid, cell: SumTrailCell): SumTrailCell[] {
  const deltas = [
    { r: -1, c: 0 },
    { r: 1, c: 0 },
    { r: 0, c: -1 },
    { r: 0, c: 1 },
  ];
  const out: SumTrailCell[] = [];
  for (const d of deltas) {
    const next = { r: cell.r + d.r, c: cell.c + d.c };
    if (isInBounds(grid, next)) out.push(next);
  }
  return out;
}

/** 열 단위로 아래로 압축 (0은 위쪽으로) */
export function applyGravity(grid: SumTrailGrid): SumTrailGrid {
  const n = gridSize(grid);
  const next = emptyGrid(n);
  for (let c = 0; c < n; c += 1) {
    const stack: number[] = [];
    for (let r = n - 1; r >= 0; r -= 1) {
      const v = grid[r]?.[c] ?? 0;
      if (v > 0) stack.push(v);
    }
    let r = n - 1;
    for (const v of stack) {
      next[r]![c] = v;
      r -= 1;
    }
  }
  return next;
}

export function clearPath(grid: SumTrailGrid, path: SumTrailCell[]): SumTrailGrid {
  const next = cloneGrid(grid);
  for (const cell of path) {
    if (isInBounds(next, cell)) next[cell.r]![cell.c] = 0;
  }
  return applyGravity(next);
}

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: Rng, min: number, maxInclusive: number): number {
  return min + Math.floor(rng() * (maxInclusive - min + 1));
}

function shuffleInPlace<T>(arr: T[], rng: Rng): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

export function fillRandomGrid(size: number, rng: Rng): SumTrailGrid {
  const grid = emptyGrid(size);
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      grid[r]![c] = randInt(rng, 1, 9);
    }
  }
  return grid;
}

/**
 * 채워진 칸에서 길이 [minLen, maxLen] 경로를 하나 찾는다 (생성·타깃용).
 * 실패 시 null.
 */
export function findRandomPath(
  grid: SumTrailGrid,
  minLen: number,
  maxLen: number,
  rng: Rng,
): SumTrailCell[] | null {
  const filled: SumTrailCell[] = [];
  const n = gridSize(grid);
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if ((grid[r]?.[c] ?? 0) > 0) filled.push({ r, c });
    }
  }
  if (filled.length < minLen) return null;
  shuffleInPlace(filled, rng);
  const targetLen = randInt(rng, minLen, Math.min(maxLen, filled.length));

  for (const start of filled) {
    const path: SumTrailCell[] = [start];
    const used = new Set<string>([cellKey(start)]);
    let ok = true;
    while (path.length < targetLen) {
      const last = path[path.length - 1]!;
      const cand = orthogonalNeighbors(grid, last).filter(
        (nb) => (grid[nb.r]?.[nb.c] ?? 0) > 0 && !used.has(cellKey(nb)),
      );
      if (cand.length === 0) {
        ok = false;
        break;
      }
      shuffleInPlace(cand, rng);
      const pick = cand[0]!;
      path.push(pick);
      used.add(cellKey(pick));
    }
    if (ok && path.length >= minLen) return path;
  }
  return null;
}

/** 남은 칸으로 새 타깃을 고른다. 불가능하면 null */
export function pickTarget(
  grid: SumTrailGrid,
  minPathLen: number,
  maxPathLen: number,
  rng: Rng,
): { target: number; witness: SumTrailCell[] } | null {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const path = findRandomPath(grid, minPathLen, maxPathLen, rng);
    if (!path) continue;
    const target = pathSum(grid, path);
    if (target > 0) return { target, witness: path };
  }
  // fallback: 인접 두 칸이라도
  const short = findRandomPath(grid, Math.min(2, minPathLen), Math.min(3, maxPathLen), rng);
  if (short) return { target: pathSum(grid, short), witness: short };
  return null;
}

export function canExtendPath(grid: SumTrailGrid, path: SumTrailCell[], next: SumTrailCell): boolean {
  if (!isInBounds(grid, next)) return false;
  if ((grid[next.r]?.[next.c] ?? 0) <= 0) return false;
  if (path.some((c) => cellsEqual(c, next))) return false;
  if (path.length === 0) return true;
  return isAdjacent(path[path.length - 1]!, next);
}

export function pathMatchesTarget(grid: SumTrailGrid, path: SumTrailCell[], target: number): boolean {
  return path.length >= 2 && pathSum(grid, path) === target;
}


function freshBoard(
  level: number,
  difficulty: SumTrailDifficulty,
  rng: Rng,
  score: number,
): SumTrailState {
  const cfg = levelConfig(level, difficulty);
  let grid = fillRandomGrid(cfg.size, rng);
  let picked = pickTarget(grid, cfg.minPathLen, cfg.maxPathLen, rng);
  // 드물게 실패하면 한 번 더
  if (!picked) {
    grid = fillRandomGrid(cfg.size, rng);
    picked = pickTarget(grid, cfg.minPathLen, cfg.maxPathLen, rng);
  }
  return {
    level,
    difficulty,
    grid,
    target: picked?.target ?? 10,
    path: [],
    clears: 0,
    clearsNeeded: cfg.clearsToClearLevel,
    status: 'playing',
    score,
  };
}

export function createSumTrailGame(
  difficulty: SumTrailDifficulty = 'normal',
  seed?: number,
): SumTrailState {
  const rng = mulberry32(seed ?? Date.now() >>> 0);
  return freshBoard(1, difficulty, rng, 0);
}

export function restartSumTrailLevel(state: SumTrailState, seed?: number): SumTrailState {
  const rng = mulberry32(seed ?? (Date.now() ^ (state.level * 997)) >>> 0);
  return freshBoard(state.level, state.difficulty, rng, state.score);
}

export function nextSumTrailLevel(state: SumTrailState, seed?: number): SumTrailState {
  const rng = mulberry32(seed ?? (Date.now() ^ (state.level * 1337)) >>> 0);
  return freshBoard(state.level + 1, state.difficulty, rng, state.score);
}

export function tapSumTrailCell(
  state: SumTrailState,
  cell: SumTrailCell,
  seed?: number,
): SumTrailState {
  if (state.status !== 'playing') return state;
  if (!canExtendPath(state.grid, state.path, cell)) {
    // 경로의 마지막 칸을 다시 누르면 한 칸 취소
    const last = state.path[state.path.length - 1];
    if (last && last.r === cell.r && last.c === cell.c) {
      return { ...state, path: state.path.slice(0, -1) };
    }
    return state;
  }
  const path = [...state.path, cell];
  if (!pathMatchesTarget(state.grid, path, state.target)) {
    return { ...state, path };
  }

  // 타깃 달성 → 클리어
  const clearedGrid = clearPath(state.grid, path);
  const clears = state.clears + 1;
  const gained = state.target + path.length * 2;
  const score = state.score + gained;
  const cfg = levelConfig(state.level, state.difficulty);

  if (clears >= state.clearsNeeded || countFilled(clearedGrid) < 2) {
    return {
      ...state,
      grid: clearedGrid,
      path: [],
      clears,
      score,
      status: 'cleared',
      target: 0,
    };
  }

  const rng = mulberry32(seed ?? (Date.now() ^ clears ^ pathSum(state.grid, path)) >>> 0);
  const picked = pickTarget(clearedGrid, cfg.minPathLen, cfg.maxPathLen, rng);
  if (!picked) {
    return {
      ...state,
      grid: clearedGrid,
      path: [],
      clears,
      score,
      status: 'cleared',
      target: 0,
    };
  }
  return {
    ...state,
    grid: clearedGrid,
    path: [],
    clears,
    score,
    target: picked.target,
    status: 'playing',
  };
}

export function undoSumTrailPath(state: SumTrailState): SumTrailState {
  if (state.status !== 'playing' || state.path.length === 0) return state;
  return { ...state, path: state.path.slice(0, -1) };
}

export function clearSumTrailPath(state: SumTrailState): SumTrailState {
  if (state.status !== 'playing' || state.path.length === 0) return state;
  return { ...state, path: [] };
}

export function currentPathSum(state: SumTrailState): number {
  return pathSum(state.grid, state.path);
}
