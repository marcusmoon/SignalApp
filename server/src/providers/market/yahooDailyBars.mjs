const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function defaultYahooSymbol(symbol) {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return '';
  if (normalized.includes('.')) return normalized;
  if (/^\d{6}$/.test(normalized)) return `${normalized}.KS`;
  return normalized;
}

function normalizeInstrument(input = {}) {
  const symbol = normalizeSymbol(input.symbol || input.krxSymbol || input.code);
  const name = String(input.name || input.displayName || symbol || '').trim();
  const displaySymbol = String(input.displaySymbol || input.englishName || '').trim();
  const rank = Number(input.rank);
  return {
    symbol,
    displaySymbol: displaySymbol || symbol,
    name: name || symbol,
    yahooSymbol: String(input.yahooSymbol || input.yahooTicker || defaultYahooSymbol(symbol)).trim().toUpperCase(),
    rank: Number.isFinite(rank) && rank > 0 ? Math.round(rank) : null,
  };
}

function ymdFromEpochSeconds(seconds) {
  const ms = finiteNumber(seconds);
  if (ms == null) return null;
  const date = new Date(ms * 1000);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function barsFromChart(json) {
  const result = json?.chart?.result?.[0];
  if (!result) return [];
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const quote = result.indicators?.quote?.[0] || {};
  const adjclose = result.indicators?.adjclose?.[0]?.adjclose;
  const opens = Array.isArray(quote.open) ? quote.open : [];
  const highs = Array.isArray(quote.high) ? quote.high : [];
  const lows = Array.isArray(quote.low) ? quote.low : [];
  const closes = Array.isArray(quote.close) ? quote.close : [];
  const volumes = Array.isArray(quote.volume) ? quote.volume : [];
  const adj = Array.isArray(adjclose) ? adjclose : [];

  const bars = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const date = ymdFromEpochSeconds(timestamps[i]);
    const close = finiteNumber(closes[i]);
    if (!date || close == null) continue;
    bars.push({
      date,
      open: finiteNumber(opens[i]),
      high: finiteNumber(highs[i]),
      low: finiteNumber(lows[i]),
      close,
      adjClose: finiteNumber(adj[i]) ?? close,
      volume: finiteNumber(volumes[i]),
    });
  }
  // Yahoo returns ascending timestamps, but guard against unsorted payloads.
  bars.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  // Collapse duplicate dates by keeping the last sample of each session.
  const byDate = new Map();
  for (const bar of bars) byDate.set(bar.date, bar);
  return [...byDate.values()];
}

async function fetchYahooDailyBars(yahooSymbol, { range = '1y', interval = '1d' } = {}) {
  const symbol = String(yahooSymbol || '').trim();
  if (!symbol) return [];
  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
  const res = await fetch(url, { headers: { 'user-agent': 'SignalApp/quant-bars' } });
  const body = await res.text();
  if (!res.ok) throw new Error(`YAHOO_BARS_${res.status}:${body.slice(0, 160)}`);
  const json = JSON.parse(body);
  return barsFromChart(json);
}

function buildSeriesRow({ instrument, bars, range, fetchedAt }) {
  const trimmed = bars.length > 600 ? bars.slice(bars.length - 600) : bars;
  return {
    id: instrument.symbol,
    symbol: instrument.symbol,
    displaySymbol: instrument.displaySymbol,
    name: instrument.name,
    yahooSymbol: instrument.yahooSymbol,
    rank: instrument.rank,
    currency: 'KRW',
    range,
    interval: '1d',
    barCount: trimmed.length,
    firstBarDate: trimmed[0]?.date || null,
    lastBarDate: trimmed[trimmed.length - 1]?.date || null,
    lastClose: trimmed[trimmed.length - 1]?.close ?? null,
    bars: trimmed,
    fetchedAt,
  };
}

/**
 * Fetches daily OHLCV history for the given instruments (KRX symbols use the
 * `{code}.KS` Yahoo ticker). The result is one persisted row per symbol holding
 * the full bar series, which the quant factor engine reads on demand.
 */
export async function fetchYahooKoreaDailyBars(params = {}) {
  const range = String(params.range || '1y').trim() || '1y';
  const requestDelayMs = Math.max(0, Number(params.requestDelayMs) || 120);
  const instruments = (Array.isArray(params.instruments) ? params.instruments : [])
    .map(normalizeInstrument)
    .filter((item) => item.symbol && item.yahooSymbol);
  if (instruments.length === 0) return [];

  const fetchedAt = new Date().toISOString();
  const rows = [];
  for (let i = 0; i < instruments.length; i += 1) {
    const instrument = instruments[i];
    try {
      const bars = await fetchYahooDailyBars(instrument.yahooSymbol, { range });
      if (bars.length > 0) {
        rows.push(buildSeriesRow({ instrument, bars, range, fetchedAt }));
      }
    } catch {
      // Keep the batch resilient; a single failing symbol should not abort ingestion.
    }
    if (requestDelayMs > 0 && i < instruments.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, requestDelayMs));
    }
  }
  return rows;
}
