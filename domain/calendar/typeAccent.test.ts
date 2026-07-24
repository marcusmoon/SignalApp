import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SIGNAL_LIGHT } from '../../constants/theme.ts';
import { calendarTypeAccent } from './typeAccent.ts';

describe('calendarTypeAccent', () => {
  it('keeps type hues distinct for scan (regression: fed≈fomc)', () => {
    const theme = SIGNAL_LIGHT;
    assert.equal(calendarTypeAccent(theme, 'earnings'), theme.green);
    assert.equal(calendarTypeAccent(theme, 'macro'), theme.accentBlue);
    assert.equal(calendarTypeAccent(theme, 'fed'), theme.accentOrange);
    assert.equal(calendarTypeAccent(theme, 'fomc'), theme.danger);
    assert.equal(calendarTypeAccent(theme, 'holiday'), theme.textMuted);
    assert.notEqual(calendarTypeAccent(theme, 'fed'), calendarTypeAccent(theme, 'fomc'));
  });
});
