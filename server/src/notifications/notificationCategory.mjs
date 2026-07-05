const ALERT_FILTERS = new Set(['all', 'high', 'signal', 'system']);

const SIGNAL_TYPES = [
  'market_briefing',
  'today_briefing',
  'news_digest',
  'insight_signal',
  'market_alert',
  'earnings_reminder',
];

const SIGNAL_SOURCES = ['market_briefing', 'today_briefing', 'news_digest', 'insight'];

const SYSTEM_TYPES = ['service_notice', 'app_update'];

const SYSTEM_SOURCES = ['app_update', 'admin'];

const SIGNAL_HAYSTACK = '시그널|signal|insight|인사이트|브리핑|briefing|실적|earnings';
const SYSTEM_HAYSTACK = '공지|notice|업데이트|update|ota|계정|로그인|login|password|비밀번호';

export function normalizeNotificationAlertFilter(value) {
  const text = String(value || '').trim().toLowerCase();
  return ALERT_FILTERS.has(text) ? text : 'all';
}

function haystackExpr(alias) {
  return `LOWER(CONCAT(COALESCE(${alias}.title, ''), ' ', COALESCE(${alias}.payload->>'body', '')))`;
}

function pushSignalParams(params) {
  params.push(SIGNAL_TYPES, SIGNAL_SOURCES, SIGNAL_HAYSTACK);
  return {
    typesIdx: params.length - 2,
    sourcesIdx: params.length - 1,
    haystackIdx: params.length,
  };
}

function signalClause(alias, params) {
  const { typesIdx, sourcesIdx, haystackIdx } = pushSignalParams(params);
  return `(
    LOWER(COALESCE(${alias}.type, '')) = ANY($${typesIdx}::text[])
    OR LOWER(COALESCE(${alias}.source_type, '')) = ANY($${sourcesIdx}::text[])
    OR ${haystackExpr(alias)} ~ $${haystackIdx}
  )`;
}

function systemClause(alias, params) {
  params.push(SYSTEM_TYPES, SYSTEM_SOURCES, SYSTEM_HAYSTACK);
  const typesIdx = params.length - 2;
  const sourcesIdx = params.length - 1;
  const haystackIdx = params.length;
  return `(
    LOWER(COALESCE(${alias}.type, '')) = ANY($${typesIdx}::text[])
    OR LOWER(COALESCE(${alias}.source_type, '')) = ANY($${sourcesIdx}::text[])
    OR LOWER(COALESCE(${alias}.type, '')) LIKE '%account%'
    OR LOWER(COALESCE(${alias}.source_type, '')) LIKE '%account%'
    OR ${haystackExpr(alias)} ~ $${haystackIdx}
  )`;
}

/** Returns SQL fragment prefixed with AND, mutating params in place. */
export function buildNotificationCategoryClause(filter, alias = 'n', params = []) {
  const normalized = normalizeNotificationAlertFilter(filter);
  if (normalized === 'all') return '';
  if (normalized === 'high') {
    params.push('high');
    return `AND LOWER(COALESCE(${alias}.priority, '')) = $${params.length}`;
  }
  if (normalized === 'signal') {
    return `AND ${signalClause(alias, params)}`;
  }
  if (normalized === 'system') {
    const signal = signalClause(alias, params);
    const system = systemClause(alias, params);
    return `AND NOT (${signal}) AND ${system}`;
  }
  return '';
}
