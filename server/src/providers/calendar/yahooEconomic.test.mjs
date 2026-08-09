import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchYahooEconomicCalendar, normalizeYahooEconomicRow } from './yahooEconomic.mjs';

test('normalizeYahooEconomicRow maps visualization row', () => {
  const indexMap = new Map([
    ['event', 0],
    ['country code', 1],
    ['event time', 2],
    ['for', 3],
    ['actual', 4],
    ['market expectation', 5],
    ['prior to this', 6],
  ]);
  const row = normalizeYahooEconomicRow(
    ['CPI YY, NSA', 'US', '2026-08-12T12:30:00.000Z', 'Jul', null, 3.5, 3.4],
    indexMap,
    0,
  );
  assert.equal(row.provider, 'yahoo');
  assert.equal(row.type, 'macro');
  assert.equal(row.title, 'CPI YY, NSA');
  assert.equal(row.country, 'US');
  assert.equal(row.date, '2026-08-12');
  assert.equal(row.eventAt, '2026-08-12T12:30:00.000Z');
  assert.equal(row.estimate, 3.5);
  assert.equal(row.previous, 3.4);
  assert.equal(row.timezone, 'America/New_York');
});

test('normalizeYahooEconomicRow classifies FOMC vs regional Fed surveys', () => {
  const indexMap = new Map([
    ['event', 0],
    ['country code', 1],
    ['event time', 2],
  ]);
  assert.equal(
    normalizeYahooEconomicRow(['FOMC Rate Decision', 'US', '2026-09-17T18:00:00.000Z'], indexMap).type,
    'fomc',
  );
  assert.equal(
    normalizeYahooEconomicRow(['Philly Fed Business Indx*', 'US', '2026-08-20T12:30:00.000Z'], indexMap)
      .type,
    'macro',
  );
});

test('fetchYahooEconomicCalendar pages visualization API', async () => {
  let vizHits = 0;
  const session = { cookie: 'A1=a', crumb: 'test-crumb', userAgent: 'test' };
  const request = async (url, init = {}) => {
    vizHits += 1;
    const body = JSON.parse(String(init.body || '{}'));
    assert.equal(body.entityIdType, 'economic_event');
    assert.ok(String(url).includes('finance/visualization'));
    assert.equal(init.session.crumb, 'test-crumb');
    const rows =
      body.offset === 0
        ? [['CPI YY, NSA', 'US', '2026-08-12T12:30:00.000Z', 'Jul', null, 3.5, 3.4]]
        : [];
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          finance: {
            result: [
              {
                documents: [
                  {
                    columns: [
                      { label: 'Event' },
                      { label: 'Country Code' },
                      { label: 'Event Time' },
                      { label: 'For' },
                      { label: 'Actual' },
                      { label: 'Market Expectation' },
                      { label: 'Prior to This' },
                    ],
                    rows,
                  },
                ],
              },
            ],
          },
        });
      },
    };
  };

  const rows = await fetchYahooEconomicCalendar({
    daysAhead: 7,
    countries: ['US'],
    session,
    request,
  });
  assert.equal(vizHits, 1);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'CPI YY, NSA');
});
