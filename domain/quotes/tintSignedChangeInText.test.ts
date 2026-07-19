/**
 * 본문 변동률 틴트 — 부호/% · 비변동 % 제외 · 근처 방향 힌트.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  splitTextWithSignedChangeTints,
  textHasSignedChangeTint,
} from './tintSignedChangeInText.ts';

function kinds(text: string) {
  return splitTextWithSignedChangeTints(text).map((s) => s.kind);
}

describe('splitTextWithSignedChangeTints', () => {
  it('tints signed and arrow percents', () => {
    const segs = splitTextWithSignedChangeTints('나스닥 +1.2%, 코스피 -0.5%, ▲1%');
    assert.ok(segs.some((s) => s.kind === 'up' && s.text.includes('+1.2%')));
    assert.ok(segs.some((s) => s.kind === 'down' && s.text.includes('-0.5%')));
    assert.ok(segs.some((s) => s.kind === 'up' && s.text.includes('▲')));
  });

  it('tints labeled Korean change (regression: 2.78% 상승 plain)', () => {
    assert.ok(kinds('지수는 2.78% 상승했다').includes('up'));
    assert.ok(kinds('하락 1.1%').includes('down'));
  });

  it('tints bare percent when nearby direction hint exists', () => {
    assert.ok(kinds('장중 2.78%까지 올랐다').includes('up'));
  });

  it('does not tint ownership/share percents', () => {
    assert.equal(textHasSignedChangeTint('점유율 12%를 기록했다'), false);
    assert.equal(textHasSignedChangeTint('지분 5% 보유'), false);
  });

  it('leaves plain text without change signals', () => {
    assert.deepEqual(splitTextWithSignedChangeTints('시장 요약입니다.'), [
      { kind: 'plain', text: '시장 요약입니다.' },
    ]);
  });
});
