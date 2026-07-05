/** 앱 공시 유형 칩·Job 수집 범위와 맞춘 분류 코드 */
export const DART_TYPE_CATEGORY_CODES = ['A', 'B', 'C', 'D', 'E', 'I'];
export const SEC_TYPE_CATEGORY_CODES = ['8-K', '10-Q', '10-K', '6-K', '20-F', 'S-1'];

const DART_PATTERN_RULES = [
  ['B', /주요사항/],
  ['C', /발행|증권신고|공모|채권/],
  ['D', /지분|주식|대량보유|공개매수|소유상황|임원|주요주주/],
  ['I', /거래소|코스피|코스닥/],
  ['A', /사업보고|반기보고|분기보고|감사보고|연결감사/],
  ['E', /기타|자율공시|경영사항/],
];

const SEC_FORMS = new Set(SEC_TYPE_CATEGORY_CODES);

function cleanText(value) {
  return String(value || '').trim();
}

function dartPayload(item) {
  const raw = item?.rawPayload;
  return raw && typeof raw === 'object' ? raw : null;
}

function resolveDartCategory(item) {
  const payload = dartPayload(item);
  const apiTy = cleanText(payload?.pblntf_ty).toUpperCase();
  if (apiTy) return `dart:${apiTy}`;

  const reportName = cleanText(item?.formType || payload?.report_nm);
  if (!reportName) return 'dart:other';
  for (const [code, pattern] of DART_PATTERN_RULES) {
    if (pattern.test(reportName)) return `dart:${code}`;
  }
  return 'dart:other';
}

function resolveSecCategory(item) {
  const form = cleanText(item?.formType).toUpperCase();
  if (!form) return 'sec:other';
  const base = form.split('/')[0]?.trim();
  if (!base) return 'sec:other';
  if (SEC_FORMS.has(base)) return `sec:${base}`;
  return 'sec:other';
}

export function resolveDisclosureTypeCategory(item) {
  const stored = cleanText(item?.typeCategory);
  if (stored) return stored;

  const provider = cleanText(item?.provider).toLowerCase();
  const market = cleanText(item?.market).toLowerCase();
  if (provider === 'dart' || market === 'kr') return resolveDartCategory(item);
  if (provider === 'sec' || market === 'us') return resolveSecCategory(item);
  return 'other';
}

export const DISCLOSURE_TYPE_CATEGORY_ORDER = [
  'dart:A',
  'dart:B',
  'dart:C',
  'dart:D',
  'dart:E',
  'dart:I',
  'dart:other',
  'sec:8-K',
  'sec:10-Q',
  'sec:10-K',
  'sec:6-K',
  'sec:20-F',
  'sec:S-1',
  'sec:other',
];

export function sortDisclosureTypeCategories(keys) {
  const order = new Map(DISCLOSURE_TYPE_CATEGORY_ORDER.map((key, index) => [key, index]));
  return [...keys].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999) || a.localeCompare(b));
}
