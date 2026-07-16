/**
 * 공시 중요도 — 서버 `disclosureDigest.formImportance`와 동일 규칙.
 * 0 일반 · 1 정기/중간 · 2 중요 이벤트
 */

export type DisclosureImportance = 0 | 1 | 2;

const HIGH_IMPORTANCE_FORMS = new Set([
  '8-K',
  '6-K',
  '주요사항보고서',
  '공정공시',
  '조회공시',
]);

const MID_IMPORTANCE_FORMS = new Set([
  '10-K',
  '10-Q',
  '20-F',
  '사업보고서',
  '반기보고서',
  '분기보고서',
]);

const HIGH_TYPE_CATEGORIES = new Set(['dart:b', 'sec:8-k', 'sec:6-k']);
const MID_TYPE_CATEGORIES = new Set(['dart:a', 'sec:10-q', 'sec:10-k', 'sec:20-f']);

function cleanForm(value: string | null | undefined): string {
  return String(value || '').trim();
}

export function disclosureImportance(input: {
  formType?: string | null;
  typeCategory?: string | null;
}): DisclosureImportance {
  const cat = cleanForm(input.typeCategory).toLowerCase();
  if (HIGH_TYPE_CATEGORIES.has(cat)) return 2;
  if (MID_TYPE_CATEGORIES.has(cat)) return 1;

  const form = cleanForm(input.formType);
  const formUpper = form.toUpperCase();
  if (HIGH_IMPORTANCE_FORMS.has(form) || HIGH_IMPORTANCE_FORMS.has(formUpper)) return 2;
  if (/주요|중요|공정|조회|긴급|속보/.test(form)) return 2;
  if (MID_IMPORTANCE_FORMS.has(form) || MID_IMPORTANCE_FORMS.has(formUpper)) return 1;
  return 0;
}

export function isImportantDisclosure(input: {
  formType?: string | null;
  typeCategory?: string | null;
  importance?: number | null;
}): boolean {
  if (typeof input.importance === 'number' && Number.isFinite(input.importance)) {
    return input.importance >= 2;
  }
  return disclosureImportance(input) >= 2;
}

/** 다이제스트: 저장된 importance 또는 forms[] 중 하나라도 중요하면 true */
export function isImportantDisclosureDigest(input: {
  importance?: number | null;
  forms?: string[] | null;
  market?: string | null;
}): boolean {
  if (typeof input.importance === 'number' && Number.isFinite(input.importance)) {
    if (input.importance >= 2) return true;
    // 구 페이로드에 importance:0 기본값이 있어도 forms로 재판단
  }
  const forms = Array.isArray(input.forms) ? input.forms : [];
  return forms.some((form) => disclosureImportance({ formType: form }) >= 2);
}
