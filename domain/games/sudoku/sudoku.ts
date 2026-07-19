/** 스도쿠 — 9×9 퍼즐 생성·검증·상태 전이 */

export type SudokuDifficulty = 'easy' | 'normal' | 'hard';

export type SudokuCell = { r: number; c: number };

export type SudokuStatus = 'playing' | 'cleared';

export type SudokuGrid = number[][];

export type SudokuState = {
  difficulty: SudokuDifficulty;
  /** 초기 주어짐 (0=빈칸). given이면 수정 불가 */
  puzzle: SudokuGrid;
  /** 정답 보드 */
  solution: SudokuGrid;
  /** 현재 입력 */
  grid: SudokuGrid;
  selected: SudokuCell | null;
  status: SudokuStatus;
  mistakes: number;
  hintsRemaining: number;
  /** undo용 최근 입력 (given이 아닌 칸만) */
  history: { cell: SudokuCell; prev: number }[];
};

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

export function emptyGrid(): SudokuGrid {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => 0));
}

export function cloneGrid(grid: SudokuGrid): SudokuGrid {
  return grid.map((row) => [...row]);
}

export function cellKey(cell: SudokuCell): string {
  return `${cell.r},${cell.c}`;
}

export function hintsForDifficulty(d: SudokuDifficulty): number {
  return d === 'easy' ? 3 : d === 'normal' ? 2 : 1;
}

/** 난이도별 남길 힌트(주어짐) 칸 수 */
export function clueCountForDifficulty(d: SudokuDifficulty): number {
  return d === 'easy' ? 40 : d === 'normal' ? 32 : 26;
}

export function boxIndex(r: number, c: number): number {
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

export function isValidPlacement(grid: SudokuGrid, r: number, c: number, value: number): boolean {
  if (value < 1 || value > 9) return false;
  for (let i = 0; i < 9; i += 1) {
    if (i !== c && grid[r]![i] === value) return false;
    if (i !== r && grid[i]![c] === value) return false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let rr = br; rr < br + 3; rr += 1) {
    for (let cc = bc; cc < bc + 3; cc += 1) {
      if ((rr !== r || cc !== c) && grid[rr]![cc] === value) return false;
    }
  }
  return true;
}

/** 행·열·박스 충돌 (자기 칸 제외). value가 0이면 false */
export function hasConflict(grid: SudokuGrid, r: number, c: number): boolean {
  const value = grid[r]![c]!;
  if (value <= 0) return false;
  return !isValidPlacement(grid, r, c, value);
}

export function conflictSet(grid: SudokuGrid): Set<string> {
  const out = new Set<string>();
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      if (hasConflict(grid, r, c)) out.add(cellKey({ r, c }));
    }
  }
  return out;
}

export function isComplete(grid: SudokuGrid): boolean {
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      const v = grid[r]![c]!;
      if (v < 1 || v > 9 || hasConflict(grid, r, c)) return false;
    }
  }
  return true;
}

export function isGiven(puzzle: SudokuGrid, cell: SudokuCell): boolean {
  return puzzle[cell.r]![cell.c]! > 0;
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

function fillBox(grid: SudokuGrid, boxR: number, boxC: number, rng: Rng): void {
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
  let i = 0;
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      grid[boxR * 3 + r]![boxC * 3 + c] = digits[i]!;
      i += 1;
    }
  }
}

function findEmpty(grid: SudokuGrid): SudokuCell | null {
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      if (grid[r]![c] === 0) return { r, c };
    }
  }
  return null;
}

/** 백트래킹 솔버. randomized면 후보 숫자 셔플 */
export function solveGrid(grid: SudokuGrid, rng?: Rng): boolean {
  const empty = findEmpty(grid);
  if (!empty) return true;
  const { r, c } = empty;
  const digits = rng ? shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng) : [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (const d of digits) {
    if (!isValidPlacement(grid, r, c, d)) continue;
    grid[r]![c] = d;
    if (solveGrid(grid, rng)) return true;
    grid[r]![c] = 0;
  }
  return false;
}

/** 해 개수 카운트 (unique 검증용, limit에서 중단) */
export function countSolutions(grid: SudokuGrid, limit = 2): number {
  let count = 0;
  const dig = (g: SudokuGrid): void => {
    if (count >= limit) return;
    const empty = findEmpty(g);
    if (!empty) {
      count += 1;
      return;
    }
    const { r, c } = empty;
    for (let d = 1; d <= 9; d += 1) {
      if (!isValidPlacement(g, r, c, d)) continue;
      g[r]![c] = d;
      dig(g);
      g[r]![c] = 0;
      if (count >= limit) return;
    }
  };
  dig(cloneGrid(grid));
  return count;
}

export function generateSolvedBoard(rng: Rng): SudokuGrid {
  const grid = emptyGrid();
  // 대각 박스 3개는 서로 독립 → 빠르게 채운 뒤 나머지를 솔브
  fillBox(grid, 0, 0, rng);
  fillBox(grid, 1, 1, rng);
  fillBox(grid, 2, 2, rng);
  const ok = solveGrid(grid, rng);
  if (!ok) {
    // 이론상 거의 없음 — 재시도
    return generateSolvedBoard(rng);
  }
  return grid;
}

export function punchHoles(
  solution: SudokuGrid,
  clues: number,
  rng: Rng,
  ensureUnique = true,
): SudokuGrid {
  const puzzle = cloneGrid(solution);
  const cells = shuffle(
    Array.from({ length: 81 }, (_, i) => ({ r: Math.floor(i / 9), c: i % 9 })),
    rng,
  );
  let removed = 0;
  const targetRemove = 81 - clues;
  for (const cell of cells) {
    if (removed >= targetRemove) break;
    const prev = puzzle[cell.r]![cell.c]!;
    if (prev === 0) continue;
    puzzle[cell.r]![cell.c] = 0;
    if (ensureUnique && countSolutions(puzzle, 2) !== 1) {
      puzzle[cell.r]![cell.c] = prev;
      continue;
    }
    removed += 1;
  }
  return puzzle;
}

export function createSudokuGame(
  difficulty: SudokuDifficulty,
  seed = Date.now() >>> 0,
): SudokuState {
  const rng = mulberry32(seed);
  const solution = generateSolvedBoard(rng);
  const clues = clueCountForDifficulty(difficulty);
  // unique 검증은 비용이 커서 easy만 강제, 그 외는 가능하면 유지
  const puzzle = punchHoles(solution, clues, rng, difficulty !== 'hard');
  return {
    difficulty,
    puzzle,
    solution,
    grid: cloneGrid(puzzle),
    selected: null,
    status: 'playing',
    mistakes: 0,
    hintsRemaining: hintsForDifficulty(difficulty),
    history: [],
  };
}

export function selectSudokuCell(state: SudokuState, cell: SudokuCell | null): SudokuState {
  return { ...state, selected: cell };
}

export function inputSudokuDigit(state: SudokuState, digit: number): SudokuState {
  if (state.status !== 'playing') return state;
  if (digit < 0 || digit > 9) return state;
  const sel = state.selected;
  if (!sel) return state;
  if (isGiven(state.puzzle, sel)) return state;

  const prev = state.grid[sel.r]![sel.c]!;
  if (prev === digit) return state;

  const grid = cloneGrid(state.grid);
  grid[sel.r]![sel.c] = digit;

  let mistakes = state.mistakes;
  if (digit > 0 && digit !== state.solution[sel.r]![sel.c]) {
    mistakes += 1;
  }

  const history = [...state.history, { cell: sel, prev }];
  const status: SudokuStatus = isComplete(grid) ? 'cleared' : 'playing';
  return { ...state, grid, mistakes, history, status };
}

export function clearSudokuCell(state: SudokuState): SudokuState {
  return inputSudokuDigit(state, 0);
}

export function undoSudoku(state: SudokuState): SudokuState {
  if (state.status !== 'playing') return state;
  if (state.history.length === 0) return state;
  const history = [...state.history];
  const last = history.pop()!;
  const grid = cloneGrid(state.grid);
  grid[last.cell.r]![last.cell.c] = last.prev;
  return {
    ...state,
    grid,
    history,
    selected: last.cell,
    status: 'playing',
  };
}

export function useSudokuHint(state: SudokuState): SudokuState {
  if (state.status !== 'playing') return state;
  if (state.hintsRemaining <= 0) return state;

  const empties: SudokuCell[] = [];
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      if (state.grid[r]![c] === 0) empties.push({ r, c });
    }
  }
  if (empties.length === 0) return state;

  // 선택 칸이 비었으면 우선, 아니면 첫 빈칸
  let target = empties[0]!;
  if (
    state.selected &&
    state.grid[state.selected.r]![state.selected.c] === 0 &&
    !isGiven(state.puzzle, state.selected)
  ) {
    target = state.selected;
  } else {
    // 틀린 칸이 있으면 그곳 우선 교정
    let fixed: SudokuCell | null = null;
    for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        const v = state.grid[r]![c]!;
        if (v > 0 && !isGiven(state.puzzle, { r, c }) && v !== state.solution[r]![c]) {
          fixed = { r, c };
          break;
        }
      }
      if (fixed) break;
    }
    if (fixed) target = fixed;
  }

  const prev = state.grid[target.r]![target.c]!;
  const grid = cloneGrid(state.grid);
  const answer = state.solution[target.r]![target.c]!;
  grid[target.r]![target.c] = answer;
  const status: SudokuStatus = isComplete(grid) ? 'cleared' : 'playing';
  return {
    ...state,
    grid,
    selected: target,
    hintsRemaining: state.hintsRemaining - 1,
    history: [...state.history, { cell: target, prev }],
    status,
  };
}

export function restartSudoku(state: SudokuState): SudokuState {
  return {
    ...state,
    grid: cloneGrid(state.puzzle),
    selected: null,
    status: 'playing',
    mistakes: 0,
    hintsRemaining: hintsForDifficulty(state.difficulty),
    history: [],
  };
}

export function newSudokuGame(difficulty: SudokuDifficulty, seed?: number): SudokuState {
  return createSudokuGame(difficulty, seed);
}

/** 같은 숫자 강조용 — 선택된 칸의 값(또는 하이라이트 숫자) */
export function sameDigitCells(grid: SudokuGrid, digit: number): Set<string> {
  const out = new Set<string>();
  if (digit < 1) return out;
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      if (grid[r]![c] === digit) out.add(cellKey({ r, c }));
    }
  }
  return out;
}

export function relatedCells(cell: SudokuCell): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < 9; i += 1) {
    out.add(cellKey({ r: cell.r, c: i }));
    out.add(cellKey({ r: i, c: cell.c }));
  }
  const br = Math.floor(cell.r / 3) * 3;
  const bc = Math.floor(cell.c / 3) * 3;
  for (let r = br; r < br + 3; r += 1) {
    for (let c = bc; c < bc + 3; c += 1) {
      out.add(cellKey({ r, c }));
    }
  }
  return out;
}
