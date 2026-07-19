import { briefingDetailPublishedIso } from '@/domain/briefings/publishedIso';
import {
  newsDigestCreatedIso,
  disclosureDigestCreatedIso,
} from '@/domain/digests/createdAt';
import type {
  SignalApiDisclosureDigestItem,
  SignalApiEtfInsight,
  SignalApiMarketBriefing,
  SignalApiNewsDigestItem,
  SignalApiTodayBriefing,
} from '@/integrations/signal-api/types';
import type { AppLocale } from '@/locales/messages';
import { formatFeedItemTimeLabel, formatInstantLabel } from '@/utils/date';

export { briefingDetailPublishedIso };

export function todayBriefingDetailIso(item: SignalApiTodayBriefing | null | undefined): string | null {
  return briefingDetailPublishedIso(item);
}

export function marketBriefingDetailIso(item: SignalApiMarketBriefing | null | undefined): string | null {
  return briefingDetailPublishedIso(item);
}

export function etfInsightDetailIso(item: SignalApiEtfInsight | null | undefined): string | null {
  return briefingDetailPublishedIso(item);
}

export function newsDigestDetailIso(item: SignalApiNewsDigestItem | null | undefined): string | null {
  return item ? newsDigestCreatedIso(item) : null;
}

export function disclosureDigestDetailIso(
  item: SignalApiDisclosureDigestItem | null | undefined,
): string | null {
  return item ? disclosureDigestCreatedIso(item) : null;
}

/**
 * 상세 헤드라인 아래 시간 메타 — 상대 · 절대 (게시글 상세와 동일 패턴).
 * `prefix`가 있으면 앞에 붙인다 (예: 장중).
 */
export function formatBriefingDetailTimeMeta(
  iso: string | null | undefined,
  locale: AppLocale,
  options?: { prefix?: string | null },
): string | null {
  const value = String(iso || '').trim();
  if (!value) {
    const prefixOnly = String(options?.prefix || '').trim();
    return prefixOnly || null;
  }
  const relative = formatFeedItemTimeLabel(value, locale);
  const absolute = formatInstantLabel(value, locale);
  const time =
    relative && relative !== '—' && absolute && absolute !== '—' && relative !== absolute
      ? `${relative} · ${absolute}`
      : relative !== '—'
        ? relative
        : absolute !== '—'
          ? absolute
          : null;
  if (!time) return null;
  const prefix = String(options?.prefix || '').trim();
  return prefix ? `${prefix} · ${time}` : time;
}
