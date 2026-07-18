/** ETF insight `flowHighlights` — production shape + legacy fallbacks. */

export type EtfFlowHighlight = {
  key: string;
  etf: string | null;
  market: string | null;
  /** inflow | outflow | other */
  action: string | null;
  actionKind: 'inflow' | 'outflow' | 'other';
  /** 본문 시그널 (봐야 할 내용) */
  signal: string;
  amountLabel: string | null;
  /** 있으면 출처·외부 기사 */
  url: string | null;
  sourceName: string | null;
};

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function actionKindOf(action: string | null): EtfFlowHighlight['actionKind'] {
  const a = (action || '').toLowerCase();
  if (!a) return 'other';
  if (a === 'inflow' || a === 'in' || a === 'buy' || a === '유입' || a === '순유입' || a === '매수') {
    return 'inflow';
  }
  if (a === 'outflow' || a === 'out' || a === 'sell' || a === '유출' || a === '순유출' || a === '매도') {
    return 'outflow';
  }
  return 'other';
}

export function parseEtfFlowHighlights(
  items: unknown[] | null | undefined,
  insightId: string,
): EtfFlowHighlight[] {
  const list = Array.isArray(items) ? items : [];
  const out: EtfFlowHighlight[] = [];

  for (let index = 0; index < list.length; index += 1) {
    const raw = list[index];
    if (typeof raw === 'string') {
      const signal = raw.trim();
      if (!signal) continue;
      out.push({
        key: `${insightId}-flow-${index}`,
        etf: null,
        market: null,
        action: null,
        actionKind: 'other',
        signal,
        amountLabel: null,
        url: null,
        sourceName: null,
      });
      continue;
    }
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const etf = clean(row.etf || row.symbol) || null;
    const market = clean(row.market) || null;
    const action = clean(row.action || row.side || row.flow) || null;
    const signal =
      clean(row.signal) ||
      clean(row.summary) ||
      clean(row.label) ||
      clean(row.name) ||
      clean(row.title) ||
      '';
    const amountLabel =
      clean(row.amountLabel) ||
      clean(row.amount) ||
      clean(row.value) ||
      (typeof row.changePercent === 'number' && Number.isFinite(row.changePercent)
        ? `${row.changePercent > 0 ? '+' : ''}${row.changePercent.toFixed(2)}%`
        : '') ||
      null;
    const url = clean(row.url || row.sourceUrl) || null;
    const sourceName = clean(row.sourceName) || null;
    if (!signal && !etf) continue;
    out.push({
      key: `${insightId}-flow-${index}`,
      etf,
      market,
      action,
      actionKind: actionKindOf(action),
      signal: signal || etf || '',
      amountLabel: amountLabel || null,
      url,
      sourceName,
    });
  }

  return out;
}
