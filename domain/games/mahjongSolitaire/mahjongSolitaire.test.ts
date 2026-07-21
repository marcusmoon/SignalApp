/**
 * 마작 솔itaire 규칙·짝 맞추기·자유 타일.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createMahjongGame,
  findMahjongHint,
  isTileFree,
  kindsForDifficulty,
  layoutForDifficulty,
  remainingCount,
  tapMahjongTile,
  tileLabel,
  undoMahjong,
  useMahjongHint,
} from './mahjongSolitaire.ts';

describe('mahjongSolitaire', () => {
  it('creates a full board for each difficulty', () => {
    const easy = createMahjongGame('easy', 1);
    const normal = createMahjongGame('normal', 2);
    assert.equal(easy.tiles.length, layoutForDifficulty('easy').length);
    assert.equal(normal.tiles.length, layoutForDifficulty('normal').length);
    assert.equal(easy.status, 'playing');
    assert.equal(remainingCount(easy), easy.tiles.length);
  });

  it('assigns pairs of kinds', () => {
    const g = createMahjongGame('easy', 99);
    const kinds = g.tiles.map((t) => t.kind);
    const counts = new Map<string, number>();
    for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
    for (const n of counts.values()) assert.equal(n, 2);
    assert.equal(kinds.length, kindsForDifficulty('easy').length * 2);
  });

  it('selects and matches identical free tiles', () => {
    let g = createMahjongGame('easy', 3);
    let pair: [string, string] | null = null;
    for (let seed = 3; seed < 40 && !pair; seed += 1) {
      g = createMahjongGame('easy', seed);
      const free = g.tiles.filter((t) => isTileFree(g, t.id));
      for (let i = 0; i < free.length; i += 1) {
        for (let j = i + 1; j < free.length; j += 1) {
          if (free[i]!.kind === free[j]!.kind) {
            pair = [free[i]!.id, free[j]!.id];
            break;
          }
        }
        if (pair) break;
      }
    }
    assert.ok(pair);
    g = tapMahjongTile(g, pair![0]);
    g = tapMahjongTile(g, pair![1]);
    assert.equal(g.matches, 1);
    assert.ok(g.score > 0);
  });

  it('finds hints and undoes last match', () => {
    let g = createMahjongGame('easy', 4);
    const hint = findMahjongHint(g);
    assert.ok(hint);
    g = useMahjongHint(g);
    assert.ok(g.selectedId);
    assert.equal(g.hintsRemaining, 4);
    const before = g;
    g = tapMahjongTile(tapMahjongTile(g, hint!.a), hint!.b);
    g = undoMahjong(g);
    assert.equal(g.matches, before.matches);
    assert.equal(g.score, before.score);
  });

  it('labels tiles for display', () => {
    assert.equal(tileLabel('dot-3'), '3●');
    assert.equal(tileLabel('wind-east'), '東');
    assert.equal(tileLabel('dragon-red'), '中');
  });
});
