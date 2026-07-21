/** 블록 퍼즐 — 떨어지는 블록·줄 삭제·점수 (클라이언트 전용) */

export const COLS = 10;
export const VISIBLE_ROWS = 20;
export const BOARD_ROWS = 22;

export type BlockPuzzleDifficulty = 'easy' | 'normal' | 'hard';
export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export type BlockPuzzleStatus = 'playing' | 'gameover';

export type ActivePiece = {
  type: TetrominoType;
  rotation: number;
  r: number;
  c: number;
};

export type BlockPuzzleState = {
  difficulty: BlockPuzzleDifficulty;
  /** 0=빈칸, 1–7=고정 블록 타입 */
  board: number[][];
  piece: ActivePiece | null;
  next: TetrominoType;
  bag: TetrominoType[];
  score: number;
  lines: number;
  level: number;
  status: BlockPuzzleStatus;
  /** 다음 중력 틱까지 누적 ms */
  dropMs: number;
};

export type BlockPuzzleEvent =
  | { kind: 'lines'; count: number; points: number }
  | { kind: 'gameover' };

export type BlockPuzzleStep = {
  state: BlockPuzzleState;
  events: BlockPuzzleEvent[];
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

const ALL_TYPES: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

/** 회전별 [dr, dc] 오프셋 (기준 칸 r,c) */
const SHAPES: Record<TetrominoType, readonly (readonly (readonly [number, number])[])[]> = {
  I: [
    [[0, 0], [0, 1], [0, 2], [0, 3]],
    [[0, 0], [1, 0], [2, 0], [3, 0]],
    [[0, 0], [0, 1], [0, 2], [0, 3]],
    [[0, 0], [1, 0], [2, 0], [3, 0]],
  ],
  O: [
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
  ],
  T: [
    [[0, 1], [1, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [0, 1]],
    [[0, 1], [1, 0], [1, 1], [2, 1]],
  ],
  S: [
    [[0, 1], [0, 2], [1, 0], [1, 1]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 1], [1, 2], [2, 0], [2, 1]],
    [[0, 0], [1, 0], [1, 1], [2, 1]],
  ],
  Z: [
    [[0, 0], [0, 1], [1, 1], [1, 2]],
    [[0, 2], [1, 1], [1, 2], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[0, 1], [1, 0], [1, 1], [2, 0]],
  ],
  J: [
    [[0, 0], [1, 0], [1, 1], [1, 2]],
    [[0, 1], [0, 2], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 0], [2, 1]],
  ],
  L: [
    [[0, 2], [1, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [1, 2], [2, 0]],
    [[0, 0], [0, 1], [1, 1], [2, 1]],
  ],
};

export function typeToId(type: TetrominoType): number {
  return ALL_TYPES.indexOf(type) + 1;
}

export function emptyBoard(): number[][] {
  return Array.from({ length: BOARD_ROWS }, () => Array.from({ length: COLS }, () => 0));
}

export function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row]);
}

export function levelFromLines(lines: number): number {
  return Math.floor(lines / 10) + 1;
}

export function dropIntervalMs(level: number, difficulty: BlockPuzzleDifficulty): number {
  const base = difficulty === 'easy' ? 880 : difficulty === 'normal' ? 620 : 420;
  const speedup = Math.min(Math.max(level - 1, 0), 18) * (difficulty === 'hard' ? 42 : 32);
  return Math.max(100, base - speedup);
}

export function pieceCells(piece: ActivePiece): { r: number; c: number }[] {
  const shape = SHAPES[piece.type][piece.rotation % 4]!;
  return shape.map(([dr, dc]) => ({ r: piece.r + dr, c: piece.c + dc }));
}

export function pieceFits(board: number[][], piece: ActivePiece): boolean {
  for (const { r, c } of pieceCells(piece)) {
    if (c < 0 || c >= COLS || r >= BOARD_ROWS) return false;
    if (r >= 0 && board[r]![c] !== 0) return false;
  }
  return true;
}

function shuffleBag(rng: Rng): TetrominoType[] {
  const bag = [...ALL_TYPES];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j]!, bag[i]!];
  }
  return bag;
}

function drawFromBag(
  bag: TetrominoType[],
  rng: Rng,
): { type: TetrominoType; bag: TetrominoType[] } {
  let nextBag = bag;
  if (nextBag.length === 0) nextBag = shuffleBag(rng);
  const [type, ...rest] = nextBag;
  return { type: type!, bag: rest };
}

function spawnPiece(type: TetrominoType): ActivePiece {
  return { type, rotation: 0, r: 0, c: 3 };
}

export function lineClearPoints(count: number, level: number): number {
  const table = [0, 100, 300, 500, 800];
  const base = table[Math.min(count, 4)] ?? 800;
  return base * level;
}

function clearFullLines(board: number[][]): { board: number[][]; count: number } {
  const kept = board.filter((row) => row.some((v) => v === 0));
  const cleared = board.length - kept.length;
  const next = [...kept];
  while (next.length < BOARD_ROWS) {
    next.unshift(Array.from({ length: COLS }, () => 0));
  }
  return { board: next, count: cleared };
}

function lockPieceOnBoard(board: number[][], piece: ActivePiece): number[][] {
  const next = cloneBoard(board);
  const id = typeToId(piece.type);
  for (const { r, c } of pieceCells(piece)) {
    if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < COLS) {
      next[r]![c] = id;
    }
  }
  return next;
}

function spawnNext(
  state: BlockPuzzleState,
  rng: Rng,
): BlockPuzzleStep {
  const { type, bag } = drawFromBag(state.bag, rng);
  const piece = spawnPiece(type);
  if (!pieceFits(state.board, piece)) {
    return {
      state: { ...state, piece: null, status: 'gameover' },
      events: [{ kind: 'gameover' }],
    };
  }
  const { type: nextType, bag: nextBag } = drawFromBag(bag, rng);
  return {
    state: {
      ...state,
      piece,
      next: nextType,
      bag: nextBag,
      status: 'playing',
    },
    events: [],
  };
}

function afterLock(state: BlockPuzzleState, rng: Rng): BlockPuzzleStep {
  const { board, count } = clearFullLines(state.board);
  const lines = state.lines + count;
  const level = levelFromLines(lines);
  const points = count > 0 ? lineClearPoints(count, state.level) : 0;
  const nextState: BlockPuzzleState = {
    ...state,
    board,
    lines,
    level,
    score: state.score + points,
    piece: null,
  };
  const events: BlockPuzzleEvent[] =
    count > 0 ? [{ kind: 'lines', count, points }] : [];
  const spawned = spawnNext(nextState, rng);
  return {
    state: spawned.state,
    events: [...events, ...spawned.events],
  };
}

function lockActive(state: BlockPuzzleState, rng: Rng): BlockPuzzleStep {
  if (!state.piece || state.status !== 'playing') {
    return { state, events: [] };
  }
  const board = lockPieceOnBoard(state.board, state.piece);
  return afterLock({ ...state, board }, rng);
}

export function createBlockPuzzleGame(
  difficulty: BlockPuzzleDifficulty,
  seed = Date.now(),
): BlockPuzzleState {
  const rng = mulberry32(seed >>> 0);
  const bag = shuffleBag(rng);
  const { type, bag: rest } = drawFromBag(bag, rng);
  const { type: nextType, bag: nextBag } = drawFromBag(rest, rng);
  const piece = spawnPiece(type);
  const board = emptyBoard();
  return {
    difficulty,
    board,
    piece: pieceFits(board, piece) ? piece : null,
    next: nextType,
    bag: nextBag,
    score: 0,
    lines: 0,
    level: 1,
    status: pieceFits(board, piece) ? 'playing' : 'gameover',
    dropMs: 0,
  };
}

export function newBlockPuzzleGame(difficulty: BlockPuzzleDifficulty): BlockPuzzleState {
  return createBlockPuzzleGame(difficulty);
}

export function restartBlockPuzzleGame(state: BlockPuzzleState): BlockPuzzleState {
  return newBlockPuzzleGame(state.difficulty);
}

export function changeBlockPuzzleDifficulty(
  _state: BlockPuzzleState,
  difficulty: BlockPuzzleDifficulty,
): BlockPuzzleState {
  return newBlockPuzzleGame(difficulty);
}

function withMovedPiece(state: BlockPuzzleState, piece: ActivePiece): BlockPuzzleStep {
  if (!pieceFits(state.board, piece)) {
    return { state, events: [] };
  }
  return { state: { ...state, piece }, events: [] };
}

export function moveBlockPuzzleLeft(state: BlockPuzzleState): BlockPuzzleStep {
  if (!state.piece || state.status !== 'playing') return { state, events: [] };
  const piece = { ...state.piece, c: state.piece.c - 1 };
  return withMovedPiece(state, piece);
}

export function moveBlockPuzzleRight(state: BlockPuzzleState): BlockPuzzleStep {
  if (!state.piece || state.status !== 'playing') return { state, events: [] };
  const piece = { ...state.piece, c: state.piece.c + 1 };
  return withMovedPiece(state, piece);
}

export function rotateBlockPuzzle(state: BlockPuzzleState): BlockPuzzleStep {
  if (!state.piece || state.status !== 'playing') return { state, events: [] };
  const nextRot = (state.piece.rotation + 1) % 4;
  const kicks: [number, number][] = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-2, 0],
    [2, 0],
  ];
  for (const [dr, dc] of kicks) {
    const piece: ActivePiece = {
      ...state.piece,
      rotation: nextRot,
      r: state.piece.r + dr,
      c: state.piece.c + dc,
    };
    if (pieceFits(state.board, piece)) {
      return { state: { ...state, piece }, events: [] };
    }
  }
  return { state, events: [] };
}

export function softDropBlockPuzzle(state: BlockPuzzleState, rng: Rng): BlockPuzzleStep {
  if (!state.piece || state.status !== 'playing') return { state, events: [] };
  const down = { ...state.piece, r: state.piece.r + 1 };
  if (pieceFits(state.board, down)) {
    return {
      state: { ...state, piece: down, score: state.score + 1 },
      events: [],
    };
  }
  return lockActive(state, rng);
}

export function hardDropBlockPuzzle(state: BlockPuzzleState, rng: Rng): BlockPuzzleStep {
  if (!state.piece || state.status !== 'playing') return { state, events: [] };
  let piece = state.piece;
  let dropCells = 0;
  while (pieceFits(state.board, { ...piece, r: piece.r + 1 })) {
    piece = { ...piece, r: piece.r + 1 };
    dropCells += 1;
  }
  const dropped = {
    ...state,
    piece,
    score: state.score + dropCells * 2,
  };
  return lockActive(dropped, rng);
}

export function tickBlockPuzzle(
  state: BlockPuzzleState,
  deltaMs: number,
  rng: Rng,
): BlockPuzzleStep {
  if (state.status !== 'playing' || !state.piece) {
    return { state, events: [] };
  }
  const interval = dropIntervalMs(state.level, state.difficulty);
  let dropMs = state.dropMs + Math.max(0, deltaMs);
  let current = state;
  const events: BlockPuzzleEvent[] = [];
  while (dropMs >= interval) {
    dropMs -= interval;
    const step = softDropBlockPuzzle({ ...current, dropMs }, rng);
    current = step.state;
    events.push(...step.events);
    if (current.status !== 'playing') break;
  }
  return { state: { ...current, dropMs }, events };
}

/** 보드 + 활성 조각을 합친 표시용 격자 (0=빈, 1–7=타입) */
export function displayBoard(state: BlockPuzzleState): number[][] {
  const grid = cloneBoard(state.board);
  if (state.piece && state.status === 'playing') {
    const id = typeToId(state.piece.type);
    for (const { r, c } of pieceCells(state.piece)) {
      if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < COLS) {
        grid[r]![c] = id;
      }
    }
  }
  return grid;
}

/** 화면에 보이는 20행 (상단 숨김 2행 제외) */
export function visibleBoard(state: BlockPuzzleState): number[][] {
  const full = displayBoard(state);
  return full.slice(BOARD_ROWS - VISIBLE_ROWS);
}
