import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { homeShortcutCompoundLabel } from './shortcutCompoundLabel.ts';

describe('homeShortcutCompoundLabel', () => {
  it('joins short CJK parent·child within budget', () => {
    assert.equal(homeShortcutCompoundLabel('시세', '코인'), '시세·코인');
    assert.equal(homeShortcutCompoundLabel('게시판', '미주미'), '게시판·미주미');
    assert.equal(homeShortcutCompoundLabel('뉴스', '글로벌'), '뉴스·글로벌');
  });

  it('falls back to child when over CJK budget', () => {
    assert.equal(homeShortcutCompoundLabel('ニュース', 'グローバル'), 'グローバル');
  });

  it('allows longer Latin compounds up to 12', () => {
    assert.equal(homeShortcutCompoundLabel('Quotes', 'Coin'), 'Quotes·Coin');
  });

  it('falls back when Latin compound exceeds 12', () => {
    assert.equal(homeShortcutCompoundLabel('Quotes', 'Crypto'), 'Crypto');
  });
});
