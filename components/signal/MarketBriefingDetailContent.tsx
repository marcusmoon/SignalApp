import { useCallback, useEffect, useMemo, useState } from 'react';

import { BriefingDetailShell } from '@/components/signal/BriefingDetailShell';
import { MarketBriefingBlock } from '@/components/signal/MarketBriefingBlock';
import {
  HOME_SIGNAL_SESSIONS,
  type SignalSessionKey,
} from '@/constants/ipadHomeNav';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useQuoteChangeColors } from '@/hooks/useQuoteChangeColors';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { fetchSignalMarketBriefings } from '@/integrations/signal-api/marketBriefings';
import type { SignalApiMarketBriefing } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';
import { toYmd } from '@/utils/date';

function isSignalSessionKey(value: string): value is SignalSessionKey {
  return HOME_SIGNAL_SESSIONS.some((row) => row.key === value);
}

function normalizeSessionKey(value?: string | null): SignalSessionKey | null {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  if (isSignalSessionKey(raw)) return raw;
  if (raw === 'us-close') return 'us-overnight';
  return null;
}

export type MarketBriefingDetailContentProps = {
  session?: string | null;
  date?: string | null;
  embedded?: boolean;
  onBack?: () => void;
};

export function MarketBriefingDetailContent({
  session,
  date,
  embedded = false,
  onBack,
}: MarketBriefingDetailContentProps) {
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const quoteChange = useQuoteChangeColors();
  const sessionKey = useMemo(() => normalizeSessionKey(session), [session]);
  const ymd = useMemo(() => {
    const raw = String(date || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : toYmd(new Date());
  }, [date]);
  const [item, setItem] = useState<SignalApiMarketBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollResetKey = `${sessionKey || ''}|${ymd}`;

  const load = useCallback(
    async (forceRefresh?: boolean) => {
      if (!hasSignalApi()) {
        setItem(null);
        setError(t('errorSignalApiShort'));
        setLoading(false);
        return;
      }
      setError(null);
      try {
        const cacheMode = signalCacheMode(forceRefresh);
        const sessionDef = sessionKey
          ? HOME_SIGNAL_SESSIONS.find((row) => row.key === sessionKey)
          : null;
        const rows = await fetchSignalMarketBriefings(
          {
            date: ymd,
            limit: sessionDef ? 4 : 8,
            locale,
            ...(sessionDef
              ? {
                  market: sessionDef.market,
                  session: sessionDef.session as
                    | 'morning'
                    | 'lunch'
                    | 'evening'
                    | 'overnight'
                    | 'close',
                }
              : null),
          },
          { cacheMode },
        );
        const matched = sessionDef
          ? rows.find(
              (row) => row.market === sessionDef.market && row.session === sessionDef.session,
            ) ?? rows[0] ?? null
          : rows[0] ?? null;
        setItem(matched);
      } catch (e) {
        setError(formatSignalApiError(e, t, 'briefingErrorLoad'));
        setItem(null);
      } finally {
        setLoading(false);
      }
    },
    [locale, sessionKey, t, ymd],
  );

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const titleHeadline = item?.headline?.trim() || item?.title?.trim() || '';
  const summaryFallback = item?.summary?.trim() || '';
  const headline = titleHeadline || summaryFallback;
  const omitSummary = Boolean(item && !titleHeadline && summaryFallback);

  return (
    <BriefingDetailShell
      embedded={embedded}
      onBack={onBack}
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
      error={error}
      emptyText={!error && !item ? t('briefingSessionEmptyTitle') : null}
      headline={item ? headline : null}
      scrollResetKey={scrollResetKey}
      contentRevision={item}>
      {item ? (
        <MarketBriefingBlock
          briefing={item}
          theme={theme}
          scaleFont={scaleFont}
          changeColorConvention={quoteChange.convention ?? 'korea'}
          omitSummary={omitSummary}
        />
      ) : null}
    </BriefingDetailShell>
  );
}
