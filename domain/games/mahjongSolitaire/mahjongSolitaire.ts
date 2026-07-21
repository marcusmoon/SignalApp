/** 마작 솔itaire — 짝 맞추기·레이어·자유 타일 규칙 */

export type MahjongDifficulty = 'easy' | 'normal' | 'hard';

export type MahjongStatus = 'playing' | 'cleared' | 'stuck';

export type MahjongTile = {
  id: string;
  /** 짝 식별 키 */
  kind: string;
  x: number;
  y: number;
  layer: number;
  removed: boolean;
};

export type MahjongState = {
  difficulty: MahjongDifficulty;
  tiles: MahjongTile[];
  selectedId: string | null;
  status: MahjongStatus;
  score: number;
  matches: number;
  hintsRemaining: number;
  /** 되돌리기용 최근 짝 */
  history: { a: string; b: string }[];
};

export type Rng = () => number;

export const TILE_W = 2;
export const TILE_H = 2;

export function mulberry32(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type Pos = { x: number; y: number; layer: number };

function layoutEasy(): Pos[] {
  const p: Pos[] = [];
  for (const y of [0, 2, 4, 6]) {
    for (const x of [2, 4, 6, 8, 10, 12]) p.push({ x, y, layer: 0 });
  }
  for (const y of [1, 3, 5]) {
    for (const x of [3, 5, 7, 9, 11]) p.push({ x, y, layer: 1 });
  }
  p.push({ x: 13, y: 3, layer: 1 });
  for (const y of [2, 4]) {
    for (const x of [4, 6, 8, 10]) p.push({ x, y, layer: 2 });
  }
  return p;
}

function layoutNormal(): Pos[] {
  const p: Pos[] = [];
  for (const y of [0, 2, 4]) {
    for (const x of [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]) p.push({ x, y, layer: 0 });
  }
  for (const y of [1, 3, 5]) {
    for (const x of [1, 3, 5, 7, 9, 11, 13, 15]) p.push({ x, y, layer: 1 });
  }
  for (const y of [2, 4]) {
    for (const x of [2, 4, 6, 8, 10, 12]) p.push({ x, y, layer: 2 });
  }
  for (const x of [4, 6, 8, 10, 5, 7]) p.push({ x, y: 3, layer: 3 });
  return p;
}

export function layoutForDifficulty(d: MahjongDifficulty): Pos[] {
  return d === 'easy' ? layoutEasy() : layoutNormal();
}

export function kindsForDifficulty(d: MahjongDifficulty): string[] {
  const kinds: string[] = [];
  if (d === 'easy') {
    for (const s of ['dot', 'bamboo', 'char']) {
      for (let n = 1; n <= 6; n += 1) kinds.push(`${s}-${n}`);
    }
    for (const w of ['east', 'south', 'west', 'north']) kinds.push(`wind-${w}`);
    kinds.push('dragon-red', 'dragon-green');
    return kinds;
  }
  for (const s of ['dot', 'bamboo', 'char']) {
    for (let n = 1; n <= 9; n += 1) kinds.push(`${s}-${n}`);
  }
  for (const w of ['east', 'south', 'west', 'north']) kinds.push(`wind-${w}`);
  for (const dr of ['red', 'green', 'white']) kinds.push(`dragon-${dr}`);
  kinds.push('flower-1', 'flower-2');
  return kinds;
}

export function hintsForDifficulty(d: MahjongDifficulty): number {
  return d === 'easy' ? 5 : d === 'normal' ? 3 : 1;
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function activeTiles(state: MahjongState): MahjongTile[] {
  return state.tiles.filter((t) => !t.removed);
}

function overlaps(a: MahjongTile, b: MahjongTile): boolean {
  return Math.abs(a.x - b.x) < TILE_W && Math.abs(a.y - b.y) < TILE_H;
}

function sideBlocked(tile: MahjongTile, side: 'left' | 'right', tiles: MahjongTile[]): boolean {
  return tiles.some((t) => {
    if (t.layer !== tile.layer) return false;
    const dx = t.x - tile.x;
    if (side === 'left' ? dx !== -TILE_W : dx !== TILE_W) return false;
    return Math.abs(t.y - tile.y) < TILE_H;
  });
}

export function isTileFree(state: MahjongState, tileId: string): boolean {
  const tile = state.tiles.find((t) => t.id === tileId);
  if (!tile || tile.removed) return false;
  const active = activeTiles(state);
  const above = active.some((t) => t.layer > tile.layer && overlaps(t, tile));
  if (above) return false;
  const left = sideBlocked(tile, 'left', active);
  const right = sideBlocked(tile, 'right', active);
  return !left || !right;
}

export function freeTiles(state: MahjongState): MahjongTile[] {
  return activeTiles(state).filter((t) => isTileFree(state, t.id));
}

function matchScore(a: MahjongTile, b: MahjongTile): number {
  const layerBonus = (a.layer + b.layer) * 10;
  return 80 + layerBonus;
}

function kindsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.startsWith('flower-') && b.startsWith('flower-')) return true;
  return false;
}

function updateStatus(state: MahjongState): MahjongState {
  const remaining = activeTiles(state);
  if (remaining.length === 0) {
    return { ...state, status: 'cleared', selectedId: null };
  }
  const free = freeTiles(state);
  const kinds = new Map<string, MahjongTile[]>();
  for (const t of free) {
    const key = t.kind.startsWith('flower-') ? 'flower' : t.kind;
    const list = kinds.get(key) ?? [];
    list.push(t);
    kinds.set(key, list);
  }
  const hasMove = [...kinds.values()].some((list) => list.length >= 2);
  if (!hasMove) {
    return { ...state, status: 'stuck', selectedId: null };
  }
  return state.status === 'playing' ? state : { ...state, status: 'playing' };
}

export function createMahjongGame(difficulty: MahjongDifficulty, seed = Date.now()): MahjongState {
  const rng = mulberry32(seed >>> 0);
  const positions = layoutForDifficulty(difficulty);
  const kinds = kindsForDifficulty(difficulty);
  const pairs = shuffle(
    kinds.flatMap((k) => [k, k]),
    rng,
  );
  const tiles: MahjongTile[] = positions.map((pos, i) => ({
    id: `t${i}`,
    kind: pairs[i] ?? kinds[i % kinds.length]!,
    x: pos.x,
    y: pos.y,
    layer: pos.layer,
    removed: false,
  }));
  return {
    difficulty,
    tiles,
    selectedId: null,
    status: 'playing',
    score: 0,
    matches: 0,
    hintsRemaining: hintsForDifficulty(difficulty),
    history: [],
  };
}

export function newMahjongGame(difficulty: MahjongDifficulty): MahjongState {
  return createMahjongGame(difficulty);
}

export function restartMahjongGame(state: MahjongState): MahjongState {
  return newMahjongGame(state.difficulty);
}

export function changeMahjongDifficulty(
  _state: MahjongState,
  difficulty: MahjongDifficulty,
): MahjongState {
  return newMahjongGame(difficulty);
}

export function tapMahjongTile(state: MahjongState, tileId: string): MahjongState {
  if (state.status !== 'playing') return state;
  const tile = state.tiles.find((t) => t.id === tileId);
  if (!tile || tile.removed || !isTileFree(state, tileId)) return state;

  if (state.selectedId == null) {
    return { ...state, selectedId: tileId };
  }
  if (state.selectedId === tileId) {
    return { ...state, selectedId: null };
  }
  const other = state.tiles.find((t) => t.id === state.selectedId);
  if (!other || other.removed || !isTileFree(state, other.id)) {
    return { ...state, selectedId: tileId };
  }
  if (!kindsMatch(tile.kind, other.kind)) {
    return { ...state, selectedId: tileId };
  }
  const pts = matchScore(tile, other);
  const tiles = state.tiles.map((t) =>
    t.id === tile.id || t.id === other.id ? { ...t, removed: true } : t,
  );
  const next: MahjongState = {
    ...state,
    tiles,
    selectedId: null,
    score: state.score + pts,
    matches: state.matches + 1,
    history: [...state.history, { a: tile.id, b: other.id }],
  };
  return updateStatus(next);
}

export function undoMahjong(state: MahjongState): MahjongState {
  if (state.status !== 'playing' && state.status !== 'stuck') return state;
  const last = state.history[state.history.length - 1];
  if (!last) return state;
  const tiles = state.tiles.map((t) =>
    t.id === last.a || t.id === last.b ? { ...t, removed: false } : t,
  );
  const undoneTileA = state.tiles.find((t) => t.id === last.a);
  const undoneTileB = state.tiles.find((t) => t.id === last.b);
  const pts =
    undoneTileA && undoneTileB ? matchScore(undoneTileA, undoneTileB) : 80;
  const next: MahjongState = {
    ...state,
    tiles,
    selectedId: null,
    score: Math.max(0, state.score - pts),
    matches: Math.max(0, state.matches - 1),
    history: state.history.slice(0, -1),
    status: 'playing',
  };
  return next;
}

export type MahjongHint = { a: string; b: string } | null;

export function findMahjongHint(state: MahjongState): MahjongHint {
  const free = freeTiles(state);
  const byKind = new Map<string, MahjongTile[]>();
  for (const t of free) {
    const key = t.kind.startsWith('flower-') ? 'flower' : t.kind;
    const list = byKind.get(key) ?? [];
    list.push(t);
    byKind.set(key, list);
  }
  for (const list of byKind.values()) {
    if (list.length >= 2) {
      return { a: list[0]!.id, b: list[1]!.id };
    }
  }
  return null;
}

export function useMahjongHint(state: MahjongState): MahjongState {
  if (state.status !== 'playing' || state.hintsRemaining <= 0) return state;
  const hint = findMahjongHint(state);
  if (!hint) return state;
  return {
    ...state,
    hintsRemaining: state.hintsRemaining - 1,
    selectedId: hint.a,
  };
}

/** 보드 경계 (px 스케일 전 좌표) */
export function boardBounds(state: MahjongState): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const active = activeTiles(state);
  if (active.length === 0) {
    return { minX: 0, minY: 0, maxX: 18, maxY: 6 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const t of active) {
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x + TILE_W);
    maxY = Math.max(maxY, t.y + TILE_H);
  }
  return { minX, minY, maxX, maxY };
}

/** 타일 표시용 짧은 라벨 */
export function tileLabel(kind: string): string {
  const [head, tail] = kind.split('-');
  if (head === 'dot' || head === 'bamboo' || head === 'char') {
    const suit = head === 'dot' ? '●' : head === 'bamboo' ? '竹' : '万';
    return `${tail}${suit}`;
  }
  if (head === 'wind') {
    const map: Record<string, string> = {
      east: '東',
      south: '南',
      west: '西',
      north: '北',
    };
    return map[tail!] ?? tail ?? kind;
  }
  if (head === 'dragon') {
    const map: Record<string, string> = { red: '中', green: '發', white: '白' };
    return map[tail!] ?? tail ?? kind;
  }
  if (head === 'flower') return '花';
  return kind;
}

export function tileSuitColor(kind: string): 'dot' | 'bamboo' | 'char' | 'honor' | 'flower' {
  if (kind.startsWith('dot')) return 'dot';
  if (kind.startsWith('bamboo')) return 'bamboo';
  if (kind.startsWith('char')) return 'char';
  if (kind.startsWith('flower')) return 'flower';
  return 'honor';
}

export function remainingCount(state: MahjongState): number {
  return activeTiles(state).length;
}
