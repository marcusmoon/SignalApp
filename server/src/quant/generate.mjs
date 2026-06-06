import { nowIso } from '../db/time.mjs';
import { buildQuantSignal } from './signals.mjs';

function dateKeyInTimeZone(value, timeZone) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value || '').slice(0, 10);
  const tz = String(timeZone || '').trim();
  if (!tz) return date.toISOString().slice(0, 10);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    if (byType.year && byType.month && byType.day) return `${byType.year}-${byType.month}-${byType.day}`;
  } catch {
    // Fall back to UTC for unknown timezones.
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Computes the current quant signal for each persisted price series and shapes
 * it into a daily snapshot row. The id is keyed by `symbol:generatedDate`, so a
 * re-run on the same day overwrites that day's snapshot while earlier days are
 * preserved — building an auditable, backtestable track record over time.
 */
export function generateQuantSignalItems(db, params = {}) {
  const generatedAt = nowIso();
  const timeZone = String(params.timeZone || 'Asia/Seoul').trim() || 'Asia/Seoul';
  const generatedDate = dateKeyInTimeZone(generatedAt, timeZone);
  const minScore = Math.max(0, Math.min(100, Number(params.minScore) || 0));
  const series = Array.isArray(db.priceSeries) ? db.priceSeries : [];

  const rows = [];
  for (const entry of series) {
    if (!entry || !Array.isArray(entry.bars)) continue;
    const signal = buildQuantSignal({
      instrument: {
        symbol: entry.symbol,
        displaySymbol: entry.displaySymbol || entry.symbol,
        name: entry.name || null,
      },
      bars: entry.bars,
      asOf: generatedAt,
    });
    if (!signal || signal.score < minScore) continue;
    const symbol = String(signal.symbol || entry.symbol || '').trim().toUpperCase();
    if (!symbol) continue;
    rows.push({
      id: `quant:${symbol}:${generatedDate}`,
      kind: 'quant_signal',
      symbol,
      displaySymbol: signal.displaySymbol,
      name: signal.name,
      action: signal.action,
      level: signal.level,
      score: signal.score,
      risk: signal.risk,
      confidence: signal.confidence,
      factors: signal.factors,
      indicators: signal.indicators,
      reasonCodes: signal.reasonCodes,
      barCount: signal.barCount,
      lastBarDate: signal.lastBarDate,
      generatedDate,
      generatedAt,
    });
  }
  return rows;
}
