/**
 * 블록 퍼즐 규칙·점수·줄 삭제.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BOARD_ROWS,
  COLS,
  createBlockPuzzleGame,
  hardDropBlockPuzzle,
  levelFromLines,
  lineClearPoints,
  moveBlockPuzzleLeft,
  mulberry32,
  pieceFits,
  rotateBlockPuzzle,
  softDropBlockPuzzle,
  tickBlockPuzzle,
  type BlockPuzzleState,
  type ActivePiece,
} from './blockPuzzle.ts';

describe('blockPuzzle', () => {
  it('creates a playable game with spawn piece', () => {
    const g = createBlockPuzzleGame('normal', 42);
    assert.equal(g.status, 'playing');
    assert.ok(g.piece);
    assert.ok(g.next);
    assert.equal(g.score, 0);
    assert.equal(g.lines, 0);
    assert.equal(g.level, 1);
  });

  it('levels up every 10 lines', () => {
    assert.equal(levelFromLines(0), 1);
    assert.equal(levelFromLines(9), 1);
    assert.equal(levelFromLines(10), 2);
    assert.equal(levelFromLines(25), 3);
  });

  it('scores line clears by count and level', () => {
    assert.equal(lineClearPoints(1, 1), 100);
    assert.equal(lineClearPoints(4, 2), 1600);
  });

  it('moves and rotates when space allows', () => {
    let g = createBlockPuzzleGame('easy', 99);
    const startC = g.piece!.c;
    g = moveBlockPuzzleLeft(g).state;
    assert.equal(g.piece!.c, startC - 1);
    g = moveBlockPuzzleLeft(g).state;
    g = rotateBlockPuzzle(g).state;
    assert.ok(g.piece);
  });

  it('clears a full line and adds score', () => {
    const board = Array.from({ length: BOARD_ROWS }, () => Array.from({ length: COLS }, () => 0));
    for (let c = 0; c < COLS; c += 1) {
      board[BOARD_ROWS - 1]![c] = 1;
    }
    const piece: ActivePiece = { type: 'O', rotation: 0, r: BOARD_ROWS - 3, c: 4 };
    assert.ok(pieceFits(board, piece));
    const state: BlockPuzzleState = {
      difficulty: 'normal',
      board,
      piece,
      next: 'I',
      bag: ['T', 'S', 'Z', 'J', 'L'],
      score: 0,
      lines: 0,
      level: 1,
      status: 'playing',
      dropMs: 0,
    };
    const step = hardDropBlockPuzzle(state, mulberry32(1));
    assert.ok(step.events.some((e) => e.kind === 'lines'));
    assert.equal(step.state.lines, 1);
    assert.ok(step.state.score >= 100);
  });

  it('ticks gravity over time', () => {
    const g = createBlockPuzzleGame('easy', 7);
    const startR = g.piece!.r;
    const step = tickBlockPuzzle(g, 2000, mulberry32(7));
    assert.ok(step.state.piece!.r >= startR);
  });
});
