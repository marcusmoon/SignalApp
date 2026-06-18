import { getProviderSetting } from '../../providerSettings.mjs';

function ymdLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function finnhub(path, params = {}) {
  const setting = await getProviderSetting('finnhub');
  if (!setting.enabled) throw new Error('FINNHUB_PROVIDER_DISABLED');
  if (!setting.apiKey) throw new Error('FINNHUB_TOKEN_MISSING');
  const q = new URLSearchParams({ ...params, token: setting.apiKey });
  const res = await fetch(`https://finnhub.io/api/v1${path}?${q.toString()}`);
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Finnhub calendar ${res.status}: ${body.slice(0, 200)}`);
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`Finnhub calendar invalid JSON: ${body.slice(0, 200)}`);
  }
}

function classifyMacro(event) {
  const upper = String(event || '').toUpperCase();
  if (upper.includes('FOMC')) return 'fomc';
  if (upper.includes('FED ') || upper.includes('FEDERAL RESERVE') || upper.includes('POWELL')) return 'fed';
  return 'macro';
}

function stableHash(value) {
  const s = String(value || '').trim();
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

function stableEconomicId(raw) {
  const country = String(raw.country || 'na').trim().toLowerCase() || 'na';
  const time = String(raw.time || raw.date || '').trim();
  const event = String(raw.event || '').trim().toLowerCase();
  const unit = String(raw.unit || '').trim().toLowerCase();
  return `finnhub-economic-${country}-${time || 'no-time'}-${stableHash(`${event}|${unit}`)}`;
}

function extractEconomicCalendarRows(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.economicCalendar)) return json.economicCalendar;
  if (Array.isArray(json?.economic_calendar)) return json.economic_calendar;
  if (Array.isArray(json?.data)) return json.data;
  return [];
}

function economicEventDate(raw) {
  const time = String(raw?.time || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(time)) return time.slice(0, 10);
  const alt = String(raw?.date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(alt)) return alt.slice(0, 10);
  return null;
}

function economicEventAt(raw) {
  const time = String(raw?.time || '').trim();
  if (!time || !/^\d{4}-\d{2}-\d{2}/.test(time)) return null;
  const normalized = time.includes('T') ? time : time.replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function economicTimeLabel(raw) {
  const time = String(raw?.time || '').trim();
  if (time.length >= 16) return `${time.slice(11, 16)} ET`;
  return '';
}

function inYmdWindow(raw, fromYmd, toYmd) {
  const date = economicEventDate(raw);
  if (!date) return true;
  if (fromYmd && date < fromYmd) return false;
  if (toYmd && date > toYmd) return false;
  return true;
}

export function normalizeFinnhubEconomic(raw, index = 0) {
  const impact = String(raw.impact || '').trim().toLowerCase();
  const id = stableEconomicId(raw);
  const date = economicEventDate(raw);
  return {
    id,
    provider: 'finnhub',
    providerItemId: `${raw.country || ''}|${raw.time || raw.date || ''}|${raw.event || ''}`,
    type: classifyMacro(raw.event),
    title: String(raw.event || '').trim(),
    country: String(raw.country || '').trim() || null,
    symbol: null,
    eventAt: economicEventAt(raw),
    date,
    timeLabel: economicTimeLabel(raw),
    impact: impact === 'high' || impact === 'medium' || impact === 'low' ? impact : null,
    actual: raw.actual ?? null,
    estimate: raw.estimate ?? null,
    previous: raw.prev ?? raw.previous ?? null,
    unit: raw.unit || null,
    fiscalYear: null,
    fiscalQuarter: null,
    earningsHour: null,
    fetchedAt: new Date().toISOString(),
    rawPayload: raw,
  };
}

export function normalizeFinnhubEarning(raw) {
  return {
    id: `finnhub-earnings-${raw.symbol}-${raw.date}-${raw.year}-${raw.quarter}`,
    provider: 'finnhub',
    providerItemId: `${raw.symbol}|${raw.date}|${raw.year}|${raw.quarter}`,
    type: 'earnings',
    title: `${raw.symbol} (FY${raw.year} Q${raw.quarter})`,
    country: 'US',
    symbol: String(raw.symbol || '').trim().toUpperCase(),
    eventAt: raw.date ? `${raw.date}T00:00:00.000Z` : null,
    date: raw.date || null,
    timeLabel: raw.hour || '',
    impact: null,
    actual: raw.epsActual ?? null,
    estimate: raw.epsEstimate ?? null,
    previous: null,
    unit: 'EPS',
    fiscalYear: raw.year ?? null,
    fiscalQuarter: raw.quarter ?? null,
    earningsHour: raw.hour || null,
    fetchedAt: new Date().toISOString(),
    rawPayload: raw,
  };
}

export async function fetchFinnhubEconomicCalendar({ daysBack = 0, daysAhead = 14 } = {}) {
  const from = addDays(new Date(), -Math.max(0, Number(daysBack) || 0));
  const to = addDays(new Date(), Number(daysAhead) || 14);
  const fromYmd = ymdLocal(from);
  const toYmd = ymdLocal(to);

  let json;
  try {
    json = await finnhub('/calendar/economic', { from: fromYmd, to: toYmd });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('403')) {
      throw new Error(
        `FINNHUB_ECONOMIC_CALENDAR_FORBIDDEN: Economic calendar may require a Finnhub Economic Data subscription. ${message}`,
      );
    }
    throw error;
  }
  let rawRows = extractEconomicCalendarRows(json);

  // Some Finnhub plans respond with an empty list for ranged queries; retry unscoped then filter.
  if (rawRows.length === 0) {
    try {
      json = await finnhub('/calendar/economic');
      rawRows = extractEconomicCalendarRows(json).filter((row) => inYmdWindow(row, fromYmd, toYmd));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('403')) {
        throw new Error(
          `FINNHUB_ECONOMIC_CALENDAR_FORBIDDEN: Economic calendar may require a Finnhub Economic Data subscription. ${message}`,
        );
      }
      throw error;
    }
  }

  return rawRows.map((raw, index) => normalizeFinnhubEconomic(raw, index));
}

export async function fetchFinnhubEarningsCalendar({ daysBack = 0, daysAhead = 30 } = {}) {
  const from = addDays(new Date(), -Math.max(0, Number(daysBack) || 0));
  const to = addDays(new Date(), Number(daysAhead) || 30);
  const json = await finnhub('/calendar/earnings', { from: ymdLocal(from), to: ymdLocal(to) });
  const rows = Array.isArray(json.earningsCalendar) ? json.earningsCalendar : [];
  return rows.map((raw) => normalizeFinnhubEarning(raw));
}
