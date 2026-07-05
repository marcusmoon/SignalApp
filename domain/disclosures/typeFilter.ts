import type { SignalApiDisclosure } from '@/integrations/signal-api/types';
import type { MessageId } from '@/locales/messages';

export type DisclosureTypeFilterKey = 'all' | string;

const DART_TYPE_ORDER = ['dart:A', 'dart:B', 'dart:C', 'dart:D', 'dart:E', 'dart:I', 'dart:other'] as const;
const SEC_TYPE_ORDER = ['sec:8-K', 'sec:10-Q', 'sec:10-K', 'sec:6-K', 'sec:20-F', 'sec:S-1', 'sec:other'] as const;
const TYPE_FILTER_ORDER = [...DART_TYPE_ORDER, ...SEC_TYPE_ORDER];

export const DISCLOSURE_TYPE_LABEL: Record<string, MessageId> = {
  'dart:A': 'disclosuresTypeDartA',
  'dart:B': 'disclosuresTypeDartB',
  'dart:C': 'disclosuresTypeDartC',
  'dart:D': 'disclosuresTypeDartD',
  'dart:E': 'disclosuresTypeDartE',
  'dart:I': 'disclosuresTypeDartI',
  'dart:other': 'disclosuresTypeOther',
  'sec:8-K': 'disclosuresTypeSec8K',
  'sec:10-Q': 'disclosuresTypeSec10Q',
  'sec:10-K': 'disclosuresTypeSec10K',
  'sec:6-K': 'disclosuresTypeSec6K',
  'sec:20-F': 'disclosuresTypeSec20F',
  'sec:S-1': 'disclosuresTypeSecS1',
  'sec:other': 'disclosuresTypeOther',
};

function dartPayload(item: SignalApiDisclosure): Record<string, unknown> | null {
  const raw = item.rawPayload;
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
}

function resolveDartPblntfTy(item: SignalApiDisclosure): string {
  const payload = dartPayload(item);
  const apiTy = String(payload?.pblntf_ty || '').trim().toUpperCase();
  if (apiTy) return apiTy;

  const reportName = String(item.formType || payload?.report_nm || '').trim();
  if (!reportName) return 'other';
  if (/주요사항/.test(reportName)) return 'B';
  if (/발행|증권신고|공모|채권/.test(reportName)) return 'C';
  if (/지분|주식|대량보유|공개매수|소유상황|임원|주요주주/.test(reportName)) return 'D';
  if (/거래소|코스피|코스닥/.test(reportName)) return 'I';
  if (/사업보고|반기보고|분기보고|감사보고|연결감사/.test(reportName)) return 'A';
  if (/기타|자율공시|경영사항/.test(reportName)) return 'E';
  return 'other';
}

function resolveSecForm(item: SignalApiDisclosure): string {
  const form = String(item.formType || '').trim().toUpperCase();
  if (!form) return 'other';
  const base = form.split('/')[0]?.trim();
  if (!base) return 'other';
  if (['8-K', '10-Q', '10-K', '6-K', '20-F', 'S-1'].includes(base)) return base;
  return 'other';
}

export function disclosureTypeFilterKey(item: SignalApiDisclosure): string {
  const stored = String(item.typeCategory || '').trim();
  if (stored) return stored;

  if (item.provider === 'dart' || item.market === 'kr') {
    return `dart:${resolveDartPblntfTy(item)}`;
  }
  if (item.provider === 'sec' || item.market === 'us') {
    return `sec:${resolveSecForm(item)}`;
  }
  return 'other';
}

function sortTypeFilterKeys(keys: string[]): string[] {
  const order = new Map<string, number>(TYPE_FILTER_ORDER.map((key, index) => [key, index]));
  return [...keys].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999) || a.localeCompare(b));
}

export function availableDisclosureTypeFilters(items: SignalApiDisclosure[]): string[] {
  const keys = new Set<string>();
  for (const item of items) {
    keys.add(disclosureTypeFilterKey(item));
  }
  return sortTypeFilterKeys([...keys]);
}

export function disclosureTypeFilterLabelId(key: string): MessageId {
  return DISCLOSURE_TYPE_LABEL[key] ?? 'disclosuresTypeOther';
}

export function typeCategoryApiParam(typeFilter: DisclosureTypeFilterKey): string | undefined {
  if (typeFilter === 'all') return undefined;
  return typeFilter;
}

export function sortDisclosureTypeFilterKeys(keys: string[]): string[] {
  return sortTypeFilterKeys(keys);
}
