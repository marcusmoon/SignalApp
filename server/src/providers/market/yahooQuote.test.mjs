import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveYahooPreviousClose } from './yahooQuote.mjs';

describe('resolveYahooPreviousClose', () => {
  it('ignores stale chartPreviousClose and uses the previous daily close for US indexes', () => {
    const previousClose = resolveYahooPreviousClose(
      {
        close: [7509.2, 7498.96, 7408.3, 7411.98, 7413.18],
      },
    );

    assert.equal(previousClose, 7411.98);
  });

  it('uses the previous daily close when the latest bar is null during an open session', () => {
    const previousClose = resolveYahooPreviousClose(
      {
        close: [6747.95, 6797.7, 7096.89, 6690.62, null],
      },
    );

    assert.equal(previousClose, 6690.62);
  });
});
