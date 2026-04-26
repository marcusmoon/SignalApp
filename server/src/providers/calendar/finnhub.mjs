import { getProviderSetting } from '../../providerSettings.mjs';

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function finnhub(path, params) {
  const setting = await getProviderSetting('finnhub');
  if (!setting.enabled) throw new Error('FINNHUB_PROVIDER_DISABLED');
  if (!setting.apiKey) throw new Error('FINNHUB_TOKEN_MISSING');
  const q = new URLSearchParams({ ...params, token: setting.apiKey });
  const res = await fetch(`https://finnhub.io/api/v1${path}?${q.toString()}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Finnhub calendar ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function classifyMacro(event) {
  const upper = String(event || '').toUpperCase();
  if (upper.includes('FOMC')) return 'fomc';
  if (upper.includes('FED ') || upper.includes('FEDERAL RESERVE') || upper.includes('POWELL')) return 'fed';
  return 'macro';
}

export function normalizeFinnhubEconomic(raw, index = 0) {
  const impact = String(raw.impact || '').trim().toLowerCase();
  return {
    id: `finnhub-economic-${raw.country || 'na'}-${raw.time || index}-${index}`,
    provider: 'finnhub',
    providerItemId: `${raw.country || ''}|${raw.time || ''}|${raw.event || ''}`,
    type: classifyMacro(raw.event),
    title: String(raw.event || '').trim(),
    country: String(raw.country || '').trim() || null,
    symbol: null,
    eventAt: raw.time ? new Date(String(raw.time).replace(' ', 'T')).toISOString() : null,
    date: raw.time ? String(raw.time).slice(0, 10) : null,
    timeLabel: raw.time && String(raw.time).length >= 16 ? `${String(raw.time).slice(11, 16)} ET` : '',
    impact: impact === 'high' || impact === 'medium' || impact === 'low' ? impact : null,
    actual: raw.actual ?? null,
    estimate: raw.estimate ?? null,
    previous: raw.prev ?? null,
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
  const json = await finnhub('/calendar/economic', { from: ymd(from), to: ymd(to) });
  const rows = Array.isArray(json.economicCalendar) ? json.economicCalendar : [];
  return rows.map((raw, index) => normalizeFinnhubEconomic(raw, index));
}

export async function fetchFinnhubEarningsCalendar({ daysBack = 0, daysAhead = 30 } = {}) {
  const from = addDays(new Date(), -Math.max(0, Number(daysBack) || 0));
  const to = addDays(new Date(), Number(daysAhead) || 30);
  const json = await finnhub('/calendar/earnings', { from: ymd(from), to: ymd(to) });
  const rows = Array.isArray(json.earningsCalendar) ? json.earningsCalendar : [];
  return rows.map((raw) => normalizeFinnhubEarning(raw));
}
