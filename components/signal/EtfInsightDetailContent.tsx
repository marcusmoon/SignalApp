import { useCallback, useEffect, useState } from 'react';

import { BriefingDetailShell } from '@/components/signal/BriefingDetailShell';
import { EtfInsightBlock } from '@/components/signal/EtfInsightBlock';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import {
  fetchSignalEtfInsightById,
  fetchSignalEtfInsightForDate,
} from '@/integrations/signal-api/etfInsights';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { SignalApiEtfInsight } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';

export type EtfInsightDetailContentProps = {
  id?: string | null;
  date?: string | null;
  embedded?: boolean;
  onBack?: () => void;
};

export function EtfInsightDetailContent({
  id,
  date,
  embedded = false,
  onBack,
}: EtfInsightDetailContentProps) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const [item, setItem] = useState<SignalApiEtfInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollResetKey = `${id || ''}|${date || ''}`;

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
        const next = id?.trim()
          ? await fetchSignalEtfInsightById(id.trim(), { cacheMode })
          : date
            ? await fetchSignalEtfInsightForDate(date, { cacheMode })
            : null;
        setItem(next);
      } catch (e) {
        setError(formatSignalApiError(e, t, 'etfInsightLoadError'));
      } finally {
        setLoading(false);
      }
    },
    [date, id, t],
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

  return (
    <BriefingDetailShell
      embedded={embedded}
      onBack={onBack}
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
      error={error}
      emptyText={!error && !item ? t('etfInsightEmpty') : null}
      headline={item?.title?.trim() || null}
      scrollResetKey={scrollResetKey}
      contentRevision={item}>
      {item ? <EtfInsightBlock insight={item} theme={theme} scaleFont={scaleFont} /> : null}
    </BriefingDetailShell>
  );
}
