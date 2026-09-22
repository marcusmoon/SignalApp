export type FocusTarget = {
  id: string;
  name: { ko: string; en: string; ja: string };
  symbols: string[];
  kind: 'company' | 'etf';
};

/** Editorial research scope, independent of a user's editable quote watchlist. */
export const FOCUS_TARGETS: readonly FocusTarget[] = [
  { id: 'samsung', name: { ko: '삼성전자', en: 'Samsung', ja: 'サムスン電子' }, symbols: ['005930', '005930.KS', 'KRX:005930'], kind: 'company' },
  { id: 'sk-hynix', name: { ko: 'SK하이닉스', en: 'SK hynix', ja: 'SKハイニックス' }, symbols: ['000660', '000660.KS', 'KRX:000660'], kind: 'company' },
  { id: 'nvidia', name: { ko: '엔비디아', en: 'NVIDIA', ja: 'NVIDIA' }, symbols: ['NVDA'], kind: 'company' },
  { id: 'apple', name: { ko: '애플', en: 'Apple', ja: 'Apple' }, symbols: ['AAPL'], kind: 'company' },
  { id: 'google', name: { ko: '구글', en: 'Google', ja: 'Google' }, symbols: ['GOOG', 'GOOGL'], kind: 'company' },
  { id: 'tesla', name: { ko: '테슬라', en: 'Tesla', ja: 'Tesla' }, symbols: ['TSLA'], kind: 'company' },
  { id: 'spacex', name: { ko: 'SpaceX', en: 'SpaceX', ja: 'SpaceX' }, symbols: ['SPCX'], kind: 'company' },
  { id: 'spy', name: { ko: 'SPY', en: 'SPY', ja: 'SPY' }, symbols: ['SPY'], kind: 'etf' },
  { id: 'qqq', name: { ko: 'QQQ', en: 'QQQ', ja: 'QQQ' }, symbols: ['QQQ'], kind: 'etf' },
  { id: 'bitmine', name: { ko: '비트마인', en: 'Bitmine', ja: 'Bitmine' }, symbols: ['BMNR'], kind: 'company' },
];

export function focusSymbols(targetId = 'all'): string[] {
  return [...new Set(FOCUS_TARGETS.filter((target) => targetId === 'all' || target.id === targetId).flatMap((target) => target.symbols))];
}

export function focusTargetNames(symbols: readonly string[], locale: string): string[] {
  const keys = new Set(symbols.map((symbol) => symbol.trim().toUpperCase().replace(/^KRX:/, '').replace(/\.(KS|KQ)$/, '')));
  return FOCUS_TARGETS.filter((target) => target.symbols.some((symbol) => keys.has(symbol)))
    .map((target) => target.name[locale === 'en' || locale === 'ja' ? locale : 'ko']);
}
