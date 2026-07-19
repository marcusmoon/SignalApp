/**
 * 스도쿠 — 생성·검증·입력.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clearSudokuCell,
  clueCountForDifficulty,
  conflictSet,
  countSolutions,
  createSudokuGame,
  emptyGrid,
  generateSolvedBoard,
  hasConflict,
  inputSudokuDigit,
  isComplete,
  isValidPlacement,
  mulberry32,
  punchHoles,
  restartSudoku,
  selectSudokuCell,
  undoSudoku,
  useSudokuHint,
} from './sudoku.ts';

describe('sudoku engine', () => {
  it('rejects duplicate in row/col/box', () => {
    const grid = emptyGrid();
    grid[0]![0] = 5;
    assert.equal(isValidPlacement(grid, 0, 1, 5), false);
    assert.equal(isValidPlacement(grid, 1, 0, 5), false);
    assert.equal(isValidPlacement(grid, 1, 1, 5), false);
    assert.equal(isValidPlacement(grid, 0, 1, 6), true);
  });

  it('generates a full valid solved board', () => {
    const board = generateSolvedBoard(mulberry32(7));
    assert.equal(isComplete(board), true);
    assert.equal(countSolutions(board, 2), 1);
  });

  it('punchHoles leaves unique puzzle for easy', () => {
    const rng = mulberry32(99);
    const solution = generateSolvedBoard(rng);
    const clues = clueCountForDifficulty('easy');
    const puzzle = punchHoles(solution, clues, rng, true);
    let filled = 0;
    for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        if (puzzle[r]![c]! > 0) filled += 1;
      }
    }
    assert.ok(filled >= clues - 5);
    assert.equal(countSolutions(puzzle, 2), 1);
  });

  it('createSudokuGame starts playable', () => {
    const game = createSudokuGame('easy', 123);
    assert.equal(game.status, 'playing');
    assert.equal(game.hintsRemaining, 3);
    assert.equal(game.mistakes, 0);
    assert.ok(game.puzzle.some((row) => row.some((v) => v === 0)));
  });

  it('input corrects and clears on complete', () => {
    const game = createSudokuGame('easy', 42);
    // fill all empties with solution
    let state = game;
    for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        if (state.puzzle[r]![c]! > 0) continue;
        state = selectSudokuCell(state, { r, c });
        state = inputSudokuDigit(state, state.solution[r]![c]!);
      }
    }
    assert.equal(state.status, 'cleared');
    assert.equal(isComplete(state.grid), true);
  });

  it('wrong digit increments mistakes', () => {
    const game = createSudokuGame('normal', 5);
    let empty = { r: 0, c: 0 };
    outer: for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        if (game.puzzle[r]![c] === 0) {
          empty = { r, c };
          break outer;
        }
      }
    }
    const wrong = game.solution[empty.r]![empty.c]! === 1 ? 2 : 1;
    let state = selectSudokuCell(game, empty);
    state = inputSudokuDigit(state, wrong);
    assert.equal(state.mistakes, 1);
    assert.equal(hasConflict(state.grid, empty.r, empty.c) || state.grid[empty.r]![empty.c] === wrong, true);
  });

  it('undo restores previous value', () => {
    const game = createSudokuGame('easy', 11);
    let empty = { r: 0, c: 0 };
    outer: for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        if (game.puzzle[r]![c] === 0) {
          empty = { r, c };
          break outer;
        }
      }
    }
    let state = selectSudokuCell(game, empty);
    state = inputSudokuDigit(state, state.solution[empty.r]![empty.c]!);
    assert.equal(state.grid[empty.r]![empty.c], state.solution[empty.r]![empty.c]);
    state = undoSudoku(state);
    assert.equal(state.grid[empty.r]![empty.c], 0);
  });

  it('hint fills a correct cell and decrements', () => {
    const game = createSudokuGame('hard', 3);
    const before = game.hintsRemaining;
    const next = useSudokuHint(game);
    assert.equal(next.hintsRemaining, before - 1);
    assert.ok(next.selected);
    const { r, c } = next.selected!;
    assert.equal(next.grid[r]![c], next.solution[r]![c]);
  });

  it('clear and restart reset user fills', () => {
    const game = createSudokuGame('easy', 8);
    let empty = { r: 0, c: 0 };
    outer: for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        if (game.puzzle[r]![c] === 0) {
          empty = { r, c };
          break outer;
        }
      }
    }
    let state = selectSudokuCell(game, empty);
    state = inputSudokuDigit(state, state.solution[empty.r]![empty.c]!);
    state = clearSudokuCell(state);
    assert.equal(state.grid[empty.r]![empty.c], 0);
    state = inputSudokuDigit(state, state.solution[empty.r]![empty.c]!);
    state = restartSudoku(state);
    assert.deepEqual(state.grid, state.puzzle);
    assert.equal(state.mistakes, 0);
  });

  it('conflictSet marks duplicates', () => {
    const grid = emptyGrid();
    grid[0]![0] = 1;
    grid[0]![1] = 1;
    const set = conflictSet(grid);
    assert.ok(set.has('0,0'));
    assert.ok(set.has('0,1'));
  });
});
