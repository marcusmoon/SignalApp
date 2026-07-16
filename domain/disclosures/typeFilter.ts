import type { MessageId } from '@/locales/messages';

export type DisclosureTypeFilterKey = 'all' | string;

/** DART Job `pblntfTy`와 동일 — Admin/수집 범위와 맞춤 */
export const DART_TYPE_FILTERS = ['dart:B', 'dart:C', 'dart:D', 'dart:I'] as const;

/** SEC Job `forms`와 동일 */
export const SEC_TYPE_FILTERS = ['sec:8-K', 'sec:10-Q', 'sec:10-K', 'sec:6-K', 'sec:20-F', 'sec:S-1'] as const;

export type DisclosureTypeScope = 'us' | 'kr' | 'symbol';

export const DISCLOSURE_TYPE_LABEL: Record<string, MessageId> = {
  'dart:A': 'disclosuresTypeDartA',
  'dart:B': 'disclosuresTypeDartB',
  'dart:C': 'disclosuresTypeDartC',
  'dart:D': 'disclosuresTypeDartD',
  'dart:E': 'disclosuresTypeDartE',
  'dart:I': 'disclosuresTypeDartI',
  'sec:8-K': 'disclosuresTypeSec8K',
  'sec:10-Q': 'disclosuresTypeSec10Q',
  'sec:10-K': 'disclosuresTypeSec10K',
  'sec:6-K': 'disclosuresTypeSec6K',
  'sec:20-F': 'disclosuresTypeSec20F',
  'sec:S-1': 'disclosuresTypeSecS1',
};

export function disclosureTypeFiltersForScope(scope: DisclosureTypeScope): readonly string[] {
  if (scope === 'kr') return DART_TYPE_FILTERS;
  if (scope === 'us') return SEC_TYPE_FILTERS;
  return [...DART_TYPE_FILTERS, ...SEC_TYPE_FILTERS];
}

export function disclosureTypeFilterLabelId(key: string): MessageId {
  return DISCLOSURE_TYPE_LABEL[key] ?? 'disclosuresTypeOther';
}

export function typeCategoryApiParam(typeFilter: DisclosureTypeFilterKey): string | undefined {
  if (typeFilter === 'all') return undefined;
  return typeFilter;
}

export function resolveDisclosureTypeScope(params: {
  marketFilter: 'us' | 'kr';
  symbolFilter?: string;
}): DisclosureTypeScope {
  if (params.symbolFilter) return 'symbol';
  return params.marketFilter;
}
