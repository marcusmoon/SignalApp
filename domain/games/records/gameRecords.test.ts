/**
 * 게임 통산 기록 정규화·이벤트.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  emptyGameRecords,
  formatDurationMs,
  recordBlockPuzzleGameOver,
  recordBlockPuzzleRunStarted,
  recordMahjongCleared,
  recordMahjongRunStarted,
  normalizeGameRecords,
  recordSudokuCleared,
  recordSudokuRunStarted,
  recordSumTrailLevelCleared,
  recordSumTrailRunStarted,
} from './gameRecords.ts';

describe('gameRecords', () => {
  it('normalizes empty / garbage to defaults', () => {
    assert.deepEqual(normalizeGameRecords(null), emptyGameRecords());
    assert.deepEqual(normalizeGameRecords({}), emptyGameRecords());
  });

  it('records sum trail level clears and bests', () => {
    let r = emptyGameRecords();
    r = recordSumTrailRunStarted(r);
    r = recordSumTrailLevelCleared(r, 'normal', 3, 120);
    r = recordSumTrailLevelCleared(r, 'normal', 2, 200);
    assert.equal(r.sumTrail.runsStarted, 1);
    assert.equal(r.sumTrail.levelsCleared, 2);
    assert.equal(r.sumTrail.bestLevel, 3);
    assert.equal(r.sumTrail.bestScore, 200);
    assert.equal(r.sumTrail.byDifficulty.normal.bestLevel, 3);
    assert.equal(r.sumTrail.byDifficulty.normal.levelsCleared, 2);
  });

  it('records sudoku clears with best time/mistakes', () => {
    let r = emptyGameRecords();
    r = recordSudokuRunStarted(r);
    r = recordSudokuCleared(r, 'hard', 120_000, 3);
    r = recordSudokuCleared(r, 'hard', 90_000, 5);
    r = recordSudokuCleared(r, 'hard', 100_000, 1);
    assert.equal(r.sudoku.clears, 3);
    assert.equal(r.sudoku.byDifficulty.hard.bestTimeMs, 90_000);
    assert.equal(r.sudoku.byDifficulty.hard.bestMistakes, 1);
  });

  it('formats duration', () => {
    assert.equal(formatDurationMs(0), '0:00');
    assert.equal(formatDurationMs(65_000), '1:05');
    assert.equal(formatDurationMs(3_661_000), '1:01:01');
  });

  it('records block puzzle game overs and bests', () => {
    let r = emptyGameRecords();
    r = recordBlockPuzzleRunStarted(r);
    r = recordBlockPuzzleGameOver(r, 'normal', 1200, 8, 2);
    r = recordBlockPuzzleGameOver(r, 'normal', 900, 12, 3);
    assert.equal(r.blockPuzzle.runsStarted, 1);
    assert.equal(r.blockPuzzle.bestScore, 1200);
    assert.equal(r.blockPuzzle.bestLines, 12);
    assert.equal(r.blockPuzzle.byDifficulty.normal.bestScore, 1200);
    assert.equal(r.blockPuzzle.byDifficulty.normal.bestLines, 12);
    assert.equal(r.blockPuzzle.byDifficulty.normal.gamesPlayed, 2);
  });

  it('normalizes legacy records without block puzzle', () => {
    const r = normalizeGameRecords({ version: 1, sumTrail: {}, sudoku: {} });
    assert.equal(r.blockPuzzle.bestScore, 0);
    assert.equal(r.mahjong.clears, 0);
  });

  it('records mahjong clears with best time/score', () => {
    let r = emptyGameRecords();
    r = recordMahjongRunStarted(r);
    r = recordMahjongCleared(r, 'easy', 120_000, 800);
    r = recordMahjongCleared(r, 'easy', 90_000, 950);
    assert.equal(r.mahjong.clears, 2);
    assert.equal(r.mahjong.bestScore, 950);
    assert.equal(r.mahjong.byDifficulty.easy.bestTimeMs, 90_000);
    assert.equal(r.mahjong.byDifficulty.easy.bestScore, 950);
  });
});
