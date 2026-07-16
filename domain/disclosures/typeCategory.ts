/**
 * 공시 유형 코드 → 의미 라벨. 서버 `typeCategory.mjs` 규칙과 맞춤.
 */

import type { MessageId } from '@/locales/messages';

import { DISCLOSURE_TYPE_LABEL, disclosureTypeFilterLabelId } from './typeFilter';

const DART_PATTERN_RULES: Array<[string, RegExp]> = [
  ['B', /주요사항/],
  ['C', /발행|증권신고|공모|채권/],
  ['D', /지분|주식|대량보유|공개매수|소유상황|임원|주요주주/],
  ['I', /거래소|코스피|코스닥/],
  ['A', /사업보고|반기보고|분기보고|감사보고|연결감사/],
  ['E', /기타|자율공시|경영사항/],
];

const SEC_FORMS = new Set(['8-K', '10-Q', '10-K', '6-K', '20-F', 'S-1']);

function clean(value: string | null | undefined): string {
  return String(value || '').trim();
}

export function resolveDisclosureTypeCategory(input: {
  typeCategory?: string | null;
  provider?: string | null;
  market?: string | null;
  formType?: string | null;
}): string {
  const stored = clean(input.typeCategory);
  if (stored) return stored;

  const provider = clean(input.provider).toLowerCase();
  const market = clean(input.market).toLowerCase();
  const form = clean(input.formType);

  if (provider === 'dart' || market === 'kr') {
    for (const [code, pattern] of DART_PATTERN_RULES) {
      if (pattern.test(form)) return `dart:${code}`;
    }
    return form ? 'dart:other' : 'other';
  }

  if (provider === 'sec' || market === 'us') {
    const base = form.toUpperCase().split('/')[0]?.trim() || '';
    if (base && SEC_FORMS.has(base)) return `sec:${base}`;
    return form ? 'sec:other' : 'other';
  }

  return 'other';
}

/** form 문자열만으로 유형 추정 (다이제스트 forms[]용) */
export function typeCategoryFromForm(form: string, market: string): string {
  return resolveDisclosureTypeCategory({
    formType: form,
    market,
    provider: market === 'kr' ? 'dart' : 'sec',
  });
}

export function disclosureMeaningLabelId(typeCategory: string | null | undefined): MessageId {
  const key = clean(typeCategory);
  if (key === 'dart:A') return 'disclosuresTypeDartA';
  if (key === 'dart:E') return 'disclosuresTypeDartE';
  if (DISCLOSURE_TYPE_LABEL[key]) return disclosureTypeFilterLabelId(key);
  return 'disclosuresTypeOther';
}

export function disclosureMeaningLabelIdsForForms(
  forms: string[],
  market: string,
  limit = 2,
): MessageId[] {
  const ids: MessageId[] = [];
  const seen = new Set<string>();
  for (const form of forms) {
    const cat = typeCategoryFromForm(form, market);
    const id = disclosureMeaningLabelId(cat);
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= limit) break;
  }
  return ids;
}
