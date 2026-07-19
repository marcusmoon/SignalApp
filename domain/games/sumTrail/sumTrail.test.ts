/**
 * 합 트레일 — 경로·중력·타깃 생성.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyGravity,
  canExtendPath,
  clearPath,
  clearSumTrailPath,
  createSumTrailGame,
  currentPathSum,
  fillRandomGrid,
  findRandomPath,
  mulberry32,
  pathMatchesTarget,
  pathSum,
  pickTarget,
  tapSumTrailCell,
  undoSumTrailPath,
} from './sumTrail.ts';

describe('sumTrail engine', () => {
  it('applies column gravity after clear', () => {
    const grid = [
      [1, 0, 3],
      [0, 5, 0],
      [7, 8, 9],
    ];
    const next = clearPath(grid, [
      { r: 2, c: 0 },
      { r: 2, c: 1 },
    ]);
    assert.deepEqual(next, [
      [0, 0, 0],
      [0, 0, 3],
      [1, 5, 9],
    ]);
  });

  it('finds a solvable target on a filled board', () => {
    const rng = mulberry32(42);
    const grid = fillRandomGrid(4, rng);
    const picked = pickTarget(grid, 3, 4, rng);
    assert.ok(picked);
    assert.equal(pathSum(grid, picked!.witness), picked!.target);
    assert.ok(picked!.witness.length >= 3);
  });

  it('rejects non-adjacent path extension', () => {
    const grid = [
      [1, 2],
      [3, 4],
    ];
    assert.equal(canExtendPath(grid, [{ r: 0, c: 0 }], { r: 1, c: 1 }), false);
    assert.equal(canExtendPath(grid, [{ r: 0, c: 0 }], { r: 0, c: 1 }), true);
  });

  it('matches target only when sum equals', () => {
    const grid = [
      [1, 2],
      [3, 4],
    ];
    const path = [
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 1, c: 1 },
    ];
    assert.equal(pathSum(grid, path), 7);
    assert.equal(pathMatchesTarget(grid, path, 7), true);
    assert.equal(pathMatchesTarget(grid, path, 8), false);
  });

  it('findRandomPath respects length bounds', () => {
    const rng = mulberry32(7);
    const grid = fillRandomGrid(4, rng);
    const path = findRandomPath(grid, 3, 5, rng);
    assert.ok(path);
    assert.ok(path!.length >= 3 && path!.length <= 5);
  });

  it('applyGravity packs downward', () => {
    assert.deepEqual(
      applyGravity([
        [1, 0],
        [0, 2],
      ]),
      [
        [0, 0],
        [1, 2],
      ],
    );
  });
});

describe('sumTrail game', () => {
  it('creates a playable level with seed', () => {
    const state = createSumTrailGame('normal', 12345);
    assert.equal(state.level, 1);
    assert.equal(state.status, 'playing');
    assert.ok(state.target > 0);
    assert.equal(state.path.length, 0);
  });

  it('undo and clear path', () => {
    let state = createSumTrailGame('easy', 99);
    let tapped: { r: number; c: number } | null = null;
    outer: for (let i = 0; i < state.grid.length; i += 1) {
      for (let j = 0; j < state.grid.length; j += 1) {
        if (state.grid[i]![j]! > 0) {
          tapped = { r: i, c: j };
          state = tapSumTrailCell(state, tapped, 1);
          break outer;
        }
      }
    }
    assert.ok(tapped);
    assert.equal(state.path.length, 1);
    assert.ok(currentPathSum(state) > 0);
    state = undoSumTrailPath(state);
    assert.equal(state.path.length, 0);
    state = tapSumTrailCell(state, tapped!, 1);
    state = clearSumTrailPath(state);
    assert.equal(state.path.length, 0);
  });
});
