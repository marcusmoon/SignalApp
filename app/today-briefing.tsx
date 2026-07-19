import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { BriefingDetailShell } from '@/components/signal/BriefingDetailShell';
import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { TodayBriefingBlock } from '@/components/signal/TodayBriefingBlock';
import { useLocale } from '@/contexts/LocaleContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { fetchSignalTodayBriefing } from '@/integrations/signal-api/todayBriefings';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import type { SignalApiTodayBriefing } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';
import { toYmd } from '@/utils/date';

function parseDateParam(value: unknown): string {
  const raw = String(Array.isArray(value) ? value[0] : value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : toYmd(new Date());
}

async function fetchTodayBriefingWithFallback(
  date: string,
  locale: string,
  cacheMode: ReturnType<typeof signalCacheMode>,
): Promise<SignalApiTodayBriefing | null> {
  const primary = await fetchSignalTodayBriefing({ date, locale }, { cacheMode }).catch(() => null);
  if (primary || locale === 'ko') return primary;
  return fetchSignalTodayBriefing({ date, locale: 'ko' }, { cacheMode }).catch(() => null);
}

export type TodayBriefingContentProps = {
  date: string;
  embedded?: boolean;
  onBack?: () => void;
};

export function TodayBriefingContent({ date, embedded = false, onBack }: TodayBriefingContentProps) {
  const { t, locale } = useLocale();
  const [item, setItem] = useState<SignalApiTodayBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        setItem(await fetchTodayBriefingWithFallback(date, locale, signalCacheMode(forceRefresh)));
      } catch (e) {
        setError(formatSignalApiError(e, t, 'todayBriefingLoadError'));
      } finally {
        setLoading(false);
      }
    },
    [date, locale, t],
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

  const headline = item?.headline?.trim() || item?.summary?.trim() || item?.title?.trim() || '';

  return (
    <BriefingDetailShell
      embedded={embedded}
      onBack={onBack}
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
      error={error}
      emptyText={!error && !item ? t('todayBriefingEmpty') : null}
      headline={item ? headline : null}
      scrollResetKey={date}
      contentRevision={item}>
      {item ? (
        <TodayBriefingBlock
          briefing={item}
          titleText={headline}
          showSummary={Boolean(item.summary?.trim() && item.summary.trim() !== headline)}
        />
      ) : null}
    </BriefingDetailShell>
  );
}

export default function TodayBriefingScreen() {
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const { useTwoPane } = useResponsiveLayout();
  const date = useMemo(() => parseDateParam(params.date), [params.date]);

  if (useTwoPane) {
    return <WideOverlayRouteRedirect kind="today-briefing" params={{ date }} />;
  }

  return <TodayBriefingContent date={date} />;
}
