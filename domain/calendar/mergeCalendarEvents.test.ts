import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mergeCalendarEvents, mergeSignalCalendarEvents } from './mergeCalendarEvents.ts';

describe('mergeSignalCalendarEvents', () => {
  it('dedupes by id and sorts by date', () => {
    const merged = mergeSignalCalendarEvents([
      [
        { id: 'b', type: 'earnings', title: 'B', date: '2026-08-10' },
        { id: 'dup', type: 'macro', title: 'Dup', date: '2026-08-09' },
      ],
      [
        { id: 'a', type: 'macro', title: 'A', date: '2026-08-08' },
        { id: 'dup', type: 'macro', title: 'Dup newer', date: '2026-08-09' },
      ],
    ]);
    assert.equal(merged.length, 3);
    assert.deepEqual(
      merged.map((row) => row.id),
      ['a', 'dup', 'b'],
    );
    assert.equal(merged[1]?.title, 'Dup newer');
  });

  it('mergeCalendarEvents dedupes app rows by id', () => {
    const merged = mergeCalendarEvents([
      [
        { id: 'a', type: 'macro', date: '2026-08-08', time: '', title: 'A' },
        { id: 'dup', type: 'macro', date: '2026-08-09', time: '', title: 'Old' },
      ],
      [{ id: 'dup', type: 'macro', date: '2026-08-09', time: '', title: 'New' }],
    ]);
    assert.equal(merged.length, 2);
    assert.equal(merged.find((row) => row.id === 'dup')?.title, 'New');
  });
});
