import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calendarViewFetchType,
  calendarViewFilterTypes,
  calendarViewShowsDaySections,
  calendarViewUsesMeaningfulScope,
  isCalendarViewFilterKey,
} from './calendarViewFilter.ts';

describe('calendarViewFilter', () => {
  it('maps policy to fed + fomc', () => {
    assert.deepEqual(calendarViewFilterTypes('policy'), ['fed', 'fomc']);
    assert.equal(calendarViewFetchType('policy'), 'policy');
  });

  it('keeps key/full as mixed-type scopes', () => {
    assert.equal(calendarViewFetchType('meaningful'), undefined);
    assert.equal(calendarViewUsesMeaningfulScope('meaningful'), true);
    assert.equal(calendarViewUsesMeaningfulScope('full'), false);
    assert.equal(calendarViewShowsDaySections('full'), true);
    assert.equal(calendarViewShowsDaySections('macro'), false);
  });

  it('accepts stored keys only', () => {
    assert.equal(isCalendarViewFilterKey('meaningful'), true);
    assert.equal(isCalendarViewFilterKey('fed'), false);
  });
});
