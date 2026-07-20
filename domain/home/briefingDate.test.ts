import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { briefingsForYmd, matchesBriefingYmd } from './briefingDate.ts';

describe('briefingDate', () => {
  it('matches exact briefingDate ymd', () => {
    assert.equal(matchesBriefingYmd({ briefingDate: '2026-07-20' }, '2026-07-20'), true);
    assert.equal(matchesBriefingYmd({ briefingDate: '2026-07-19' }, '2026-07-20'), false);
    assert.equal(matchesBriefingYmd({ briefingDate: null }, '2026-07-20'), false);
  });

  it('filters rows to the selected day', () => {
    const rows = [
      { id: 'a', briefingDate: '2026-07-20' },
      { id: 'b', briefingDate: '2026-07-19' },
      { id: 'c', briefingDate: '2026-07-20' },
    ];
    assert.deepEqual(
      briefingsForYmd(rows, '2026-07-20').map((row) => row.id),
      ['a', 'c'],
    );
  });

  it('rejects stale today wrap date for today hero (regression)', () => {
    assert.equal(matchesBriefingYmd({ briefingDate: '2026-07-17' }, '2026-07-20'), false);
  });
});
