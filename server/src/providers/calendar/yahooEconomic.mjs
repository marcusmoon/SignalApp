/**
 * Yahoo Finance economic event calendar via visualization API
 * (same source as yfinance Calendars.get_economic_events_calendar).
 */

import { createYahooSession, yahooFetch } from '../yahoo/session.mjs';

const VISUALIZATION_URL = 'https://query1.finance.yahoo.com/v1/finance/visualization';
const INCLUDE_FIELDS = [
  'econ_release',
  'country_code',
  'startdatetime',
  'period',
  'after_release_actual',
  'consensus_estimate',
  'prior_release_actual',
  'originally_reported_actual',
];

function ymdUtc(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + Number(days) || 0);
  return d;
}

function finiteNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function stableHash(value) {
  const s = String(value || '').trim();
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

function classifyMacro(event) {
  const upper = String(event || '').toUpperCase();
  if (/\bFOMC\b/.test(upper)) return 'fomc';
  // Policy Fed only — do not treat “Philly Fed” / regional surveys as fed.
  if (/\bFEDERAL\s+RESERVE\b|\bFED\s+CHAIR\b|\bPOWELL\b/.test(upper)) return 'fed';
  return 'macro';
}

function timezoneForCountry(country) {
  const code = String(country || '').trim().toUpperCase();
  if (code === 'US') return 'America/New_York';
  if (code === 'KR') return 'Asia/Seoul';
  if (code === 'JP') return 'Asia/Tokyo';
  if (code === 'EU' || code === 'DE' || code === 'FR' || code === 'GB' || code === 'UK') return 'Europe/London';
  return 'UTC';
}

function ymdInTimezone(iso, timezone) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  if (!timezone || timezone === 'UTC') return date.toISOString().slice(0, 10);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    if (byType.year && byType.month && byType.day) return `${byType.year}-${byType.month}-${byType.day}`;
  } catch {
    // fall through
  }
  return date.toISOString().slice(0, 10);
}

function timeLabelFromIso(iso, timezone) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    if (byType.hour != null && byType.minute != null) return `${byType.hour}:${byType.minute}`;
  } catch {
    // fall through
  }
  return date.toISOString().slice(11, 16);
}

function normalizeCountries(countries) {
  if (!Array.isArray(countries)) return ['US'];
  const list = [
    ...new Set(
      countries
        .map((value) => String(value || '').trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
  return list;
}

function columnIndexMap(columns = []) {
  const map = new Map();
  for (let i = 0; i < columns.length; i += 1) {
    const label = String(columns[i]?.label || columns[i]?.id || '').trim().toLowerCase();
    if (label) map.set(label, i);
  }
  return map;
}

function cell(row, indexMap, ...labels) {
  for (const label of labels) {
    const idx = indexMap.get(String(label).toLowerCase());
    if (idx == null) continue;
    return row[idx];
  }
  return null;
}

export function normalizeYahooEconomicRow(row, indexMap, index = 0) {
  const title = String(cell(row, indexMap, 'event', 'econ_release') || '').trim();
  const country = String(cell(row, indexMap, 'country code', 'country_code', 'region') || '')
    .trim()
    .toUpperCase();
  const start = String(cell(row, indexMap, 'event time', 'startdatetime') || '').trim();
  if (!title || !start) return null;

  const eventAtDate = new Date(start);
  if (!Number.isFinite(eventAtDate.getTime())) return null;
  const eventAt = eventAtDate.toISOString();
  const timezone = timezoneForCountry(country);
  const date = ymdInTimezone(eventAt, timezone);
  if (!date) return null;

  const period = String(cell(row, indexMap, 'for', 'period') || '').trim() || null;
  const actual = finiteNumber(cell(row, indexMap, 'actual', 'after_release_actual'));
  const estimate = finiteNumber(cell(row, indexMap, 'market expectation', 'expected', 'consensus_estimate'));
  const previous = finiteNumber(cell(row, indexMap, 'prior to this', 'last', 'prior_release_actual'));
  const revised = finiteNumber(cell(row, indexMap, 'revised from', 'revised', 'originally_reported_actual'));

  const id = `yahoo-economic-${country || 'na'}-${date}-${stableHash(`${title}|${eventAt}|${period || ''}`)}`;
  return {
    id,
    provider: 'yahoo',
    providerItemId: `${country}|${eventAt}|${title}`,
    type: classifyMacro(title),
    title,
    country: country || null,
    symbol: null,
    eventAt,
    date,
    timeLabel: timeLabelFromIso(eventAt, timezone),
    timezone,
    impact: null,
    actual,
    estimate,
    previous: previous ?? revised,
    unit: null,
    fiscalYear: null,
    fiscalQuarter: null,
    earningsHour: null,
    fetchedAt: new Date().toISOString(),
    rawPayload: {
      provider: 'yahoo',
      time: eventAt,
      period,
      country,
      event: title,
      actual,
      estimate,
      previous,
      revised,
      index,
    },
  };
}

function parseVisualizationRows(json) {
  const doc = json?.finance?.result?.[0]?.documents?.[0];
  if (!doc) {
    const err = json?.finance?.error;
    if (err) {
      throw new Error(`YAHOO_ECONOMIC_API:${err.code || 'error'}:${err.description || JSON.stringify(err)}`);
    }
    return { columns: [], rows: [] };
  }
  return {
    columns: Array.isArray(doc.columns) ? doc.columns : [],
    rows: Array.isArray(doc.rows) ? doc.rows : [],
  };
}

async function fetchEconomicPage({ session, fromYmd, toYmd, countries, limit, offset, request }) {
  const operands = [
    { operator: 'gte', operands: ['startdatetime', fromYmd] },
    { operator: 'lte', operands: ['startdatetime', toYmd] },
  ];
  if (countries.length === 1) {
    operands.push({ operator: 'eq', operands: ['country_code', countries[0]] });
  } else if (countries.length > 1) {
    operands.push({
      operator: 'or',
      operands: countries.map((code) => ({ operator: 'eq', operands: ['country_code', code] })),
    });
  }

  const body = {
    sortType: 'ASC',
    entityIdType: 'economic_event',
    sortField: 'startdatetime',
    includeFields: INCLUDE_FIELDS,
    size: Math.max(1, Math.min(100, Number(limit) || 100)),
    offset: Math.max(0, Number(offset) || 0),
    query: { operator: 'and', operands },
  };

  const res = await request(`${VISUALIZATION_URL}?lang=en-US&region=US`, {
    session,
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`YAHOO_ECONOMIC_HTTP_${res.status}:${text.slice(0, 200)}`);
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`YAHOO_ECONOMIC_INVALID_JSON:${text.slice(0, 200)}`);
  }
  return parseVisualizationRows(json);
}

/**
 * @param {{
 *   daysBack?: number,
 *   daysAhead?: number,
 *   countries?: string[],
 *   pageSize?: number,
 *   maxPages?: number,
 *   session?: { cookie: string, crumb: string, userAgent: string },
 *   request?: typeof yahooFetch,
 * }} [opts]
 */
export async function fetchYahooEconomicCalendar({
  daysBack = 0,
  daysAhead = 14,
  countries = ['US'],
  pageSize = 100,
  maxPages = 5,
  session: existingSession = null,
  request = yahooFetch,
} = {}) {
  const from = addDays(new Date(), -Math.max(0, Number(daysBack) || 0));
  const to = addDays(new Date(), Math.max(0, Number(daysAhead) || 14));
  const fromYmd = ymdUtc(from);
  const toYmd = ymdUtc(to);
  const countryList = normalizeCountries(countries);
  const session = existingSession || (await createYahooSession());

  const out = [];
  const seen = new Set();
  const size = Math.max(1, Math.min(100, Number(pageSize) || 100));
  const pages = Math.max(1, Math.min(20, Number(maxPages) || 5));

  for (let page = 0; page < pages; page += 1) {
    const { columns, rows } = await fetchEconomicPage({
      session,
      fromYmd,
      toYmd,
      countries: countryList,
      limit: size,
      offset: page * size,
      request,
    });
    if (rows.length === 0) break;
    const indexMap = columnIndexMap(columns);
    for (let i = 0; i < rows.length; i += 1) {
      const normalized = normalizeYahooEconomicRow(rows[i], indexMap, page * size + i);
      if (!normalized || seen.has(normalized.id)) continue;
      seen.add(normalized.id);
      out.push(normalized);
    }
    if (rows.length < size) break;
  }

  return out;
}
