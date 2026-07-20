import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { marketBriefingSessionLabelId } from './sessionLabel.ts';

describe('marketBriefingSessionLabelId', () => {
  it('maps known market sessions to label ids', () => {
    assert.equal(marketBriefingSessionLabelId({ market: 'kr', session: 'morning' }), 'briefingSessionMorning');
    assert.equal(marketBriefingSessionLabelId({ market: 'kr', session: 'lunch' }), 'briefingSessionLunch');
    assert.equal(marketBriefingSessionLabelId({ market: 'kr', session: 'close' }), 'briefingSessionClose');
    assert.equal(
      marketBriefingSessionLabelId({ market: 'us', session: 'overnight' }),
      'briefingSessionOvernight',
    );
  });

  it('is case-insensitive and ignores unknown sessions', () => {
    assert.equal(marketBriefingSessionLabelId({ market: 'KR', session: 'Morning' }), 'briefingSessionMorning');
    assert.equal(marketBriefingSessionLabelId({ market: 'us', session: 'evening' }), null);
  });
});
