/**
 * 게임 이어하기 스냅샷 파서.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createBlockPuzzleGame } from '../blockPuzzle/blockPuzzle.ts';
import { createSudokuGame } from '../sudoku/sudoku.ts';
import { createSumTrailGame } from '../sumTrail/sumTrail.ts';
import {
  parseBlockPuzzleProgress,
  parseSudokuProgress,
  parseSumTrailProgress,
} from './parseGameProgress.ts';

describe('parseGameProgress', () => {
  it('round-trips sum trail progress', () => {
    const state = createSumTrailGame('easy', 1);
    const parsed = parseSumTrailProgress({
      updatedAt: '2026-01-01T00:00:00.000Z',
      difficulty: 'easy',
      state,
    });
    assert.ok(parsed);
    assert.equal(parsed!.difficulty, 'easy');
    assert.equal(parsed!.state.level, state.level);
    assert.deepEqual(parsed!.state.grid, state.grid);
  });

  it('rejects cleared sudoku progress', () => {
    const state = { ...createSudokuGame('normal', 2), status: 'cleared' as const };
    assert.equal(
      parseSudokuProgress({
        updatedAt: '2026-01-01T00:00:00.000Z',
        difficulty: 'normal',
        state,
        elapsedMs: 1000,
      }),
      null,
    );
  });

  it('parses playing sudoku progress', () => {
    const state = createSudokuGame('hard', 3);
    const parsed = parseSudokuProgress({
      updatedAt: '2026-01-01T00:00:00.000Z',
      difficulty: 'hard',
      state,
      elapsedMs: 45000,
    });
    assert.ok(parsed);
    assert.equal(parsed!.elapsedMs, 45000);
    assert.equal(parsed!.state.status, 'playing');
  });

  it('parses playing block puzzle progress', () => {
    const state = createBlockPuzzleGame('normal', 5);
    const parsed = parseBlockPuzzleProgress({
      updatedAt: '2026-01-01T00:00:00.000Z',
      difficulty: 'normal',
      state,
    });
    assert.ok(parsed);
    assert.equal(parsed!.state.score, 0);
    assert.equal(parsed!.state.status, 'playing');
  });

  it('rejects gameover block puzzle progress', () => {
    const state = { ...createBlockPuzzleGame('easy', 6), status: 'gameover' as const };
    assert.equal(
      parseBlockPuzzleProgress({
        updatedAt: '2026-01-01T00:00:00.000Z',
        difficulty: 'easy',
        state,
      }),
      null,
    );
  });
});
