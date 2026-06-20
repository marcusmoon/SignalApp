export const DEFAULT_CALENDAR_EVENT_CODE_MAPPINGS = [
  { eventType: 'macro', code: 'cpi-yoy', label: 'CPI YoY', matchType: 'regex', pattern: '\\bcpi\\b.*\\b(yoy|year)', priority: 100, enabled: true },
  { eventType: 'macro', code: 'cpi-mom', label: 'CPI MoM', matchType: 'regex', pattern: '\\bcpi\\b.*\\b(mom|month)', priority: 110, enabled: true },
  { eventType: 'macro', code: 'core-cpi-yoy', label: 'Core CPI YoY', matchType: 'regex', pattern: 'core.*\\bcpi\\b.*\\b(yoy|year)', priority: 90, enabled: true },
  { eventType: 'macro', code: 'core-cpi-mom', label: 'Core CPI MoM', matchType: 'regex', pattern: 'core.*\\bcpi\\b.*\\b(mom|month)', priority: 95, enabled: true },
  { eventType: 'macro', code: 'ppi-yoy', label: 'PPI YoY', matchType: 'regex', pattern: '\\bppi\\b.*\\b(yoy|year)', priority: 120, enabled: true },
  { eventType: 'macro', code: 'ppi-mom', label: 'PPI MoM', matchType: 'regex', pattern: '\\bppi\\b.*\\b(mom|month)', priority: 130, enabled: true },
  { eventType: 'macro', code: 'core-ppi-yoy', label: 'Core PPI YoY', matchType: 'regex', pattern: 'core.*\\bppi\\b.*\\b(yoy|year)', priority: 115, enabled: true },
  { eventType: 'macro', code: 'core-ppi-mom', label: 'Core PPI MoM', matchType: 'regex', pattern: 'core.*\\bppi\\b.*\\b(mom|month)', priority: 116, enabled: true },
  { eventType: 'macro', code: 'gdp-qoq-final', label: 'GDP QoQ Final', matchType: 'regex', pattern: '(gdp|gross domestic product).*(qoq|quarter).*final', priority: 100, enabled: true },
  { eventType: 'macro', code: 'gdp-qoq', label: 'GDP QoQ', matchType: 'regex', pattern: '(gdp|gross domestic product).*(qoq|quarter)', priority: 140, enabled: true },
  { eventType: 'macro', code: 'gdp-yoy', label: 'GDP YoY', matchType: 'regex', pattern: '(gdp|gross domestic product).*(yoy|year)', priority: 145, enabled: true },
  { eventType: 'macro', code: 'current-account', label: 'Current Account', matchType: 'contains', pattern: 'current account', priority: 150, enabled: true },
  { eventType: 'macro', code: 'initial-jobless-claims', label: 'Initial Jobless Claims', matchType: 'contains', pattern: 'initial jobless claims', priority: 150, enabled: true },
  { eventType: 'macro', code: 'nonfarm-payrolls', label: 'Nonfarm Payrolls', matchType: 'regex', pattern: '(nonfarm|non-farm).*payroll', priority: 150, enabled: true },
  { eventType: 'macro', code: 'unemployment-rate', label: 'Unemployment Rate', matchType: 'contains', pattern: 'unemployment rate', priority: 150, enabled: true },
  { eventType: 'macro', code: 'retail-sales', label: 'Retail Sales', matchType: 'contains', pattern: 'retail sales', priority: 150, enabled: true },
  { eventType: 'macro', code: 'consumer-confidence', label: 'Consumer Confidence', matchType: 'contains', pattern: 'consumer confidence', priority: 150, enabled: true },
  { eventType: 'macro', code: 'ism-manufacturing-pmi', label: 'ISM Manufacturing PMI', matchType: 'regex', pattern: 'ism.*manufacturing.*pmi', priority: 150, enabled: true },
  { eventType: 'macro', code: 'ism-services-pmi', label: 'ISM Services PMI', matchType: 'regex', pattern: 'ism.*(services|non-manufacturing).*pmi', priority: 150, enabled: true },
  { eventType: 'fomc', code: 'fomc-rate-decision', label: 'FOMC Rate Decision', matchType: 'regex', pattern: '(fomc|fed).*(rate|interest).*decision', priority: 100, enabled: true },
  { eventType: 'fomc', code: 'fomc-minutes', label: 'FOMC Minutes', matchType: 'contains', pattern: 'fomc minutes', priority: 110, enabled: true },
  { eventType: 'fed', code: 'fed-chair-speech', label: 'Fed Chair Speech', matchType: 'regex', pattern: '(powell|fed chair).*speech', priority: 100, enabled: true },
];

export function normalizeCalendarEventType(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'economic' || v === 'indicator' || v === 'macro') return 'macro';
  if (v === 'earnings' || v === 'earning') return 'earnings';
  if (v === 'holiday' || v === 'market_holiday') return 'holiday';
  if (v === 'fomc') return 'fomc';
  if (v === 'fed' || v === 'federal_reserve') return 'fed';
  return v || 'macro';
}

export function normalizeCalendarCountry(value) {
  const raw = String(value || '').trim();
  const upper = raw.toUpperCase();
  if (!upper) return 'GLOBAL';
  if (upper === 'UNITED STATES' || upper === 'USA' || upper === 'U.S.' || upper === 'US') return 'US';
  if (upper === 'KOREA' || upper === 'SOUTH KOREA' || upper === 'KOR' || upper === 'KR') return 'KR';
  return upper.slice(0, 16);
}

export function slugText(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}
