import { digestSourceIconEntries } from '@/components/signal/SourceIconStack';
import type { SignalApiDisclosure, SignalApiDisclosureDigestItem } from '@/integrations/signal-api/types';
import type { AppLocale } from '@/locales/messages';
import { formatFeedItemTimeLabel } from '@/utils/date';

export function disclosureProviderLabel(provider: string | null | undefined): string {
  if (provider === 'sec') return 'SEC';
  if (provider === 'dart') return 'DART';
  return String(provider || '—').toUpperCase();
}

export function disclosureFiledTimeLabel(
  item: Pick<SignalApiDisclosure, 'filedAt'>,
  locale: AppLocale,
): string {
  return formatFeedItemTimeLabel(item.filedAt, locale);
}

export function disclosureDigestSourceIconEntries(item: SignalApiDisclosureDigestItem) {
  const provider = String(item.market || '').trim().toLowerCase() === 'kr' ? 'DART' : 'SEC';
  return digestSourceIconEntries(
    item.sourceRefs.map((ref) => ({
      sourceName: ref.symbol || ref.companyName || provider,
      url: ref.url,
    })),
    [provider],
  );
}
