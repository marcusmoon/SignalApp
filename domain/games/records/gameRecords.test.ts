/**
 * 게임 통산 기록 정규화·이벤트.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  emptyGameRecords,
  formatDurationMs,
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
});
