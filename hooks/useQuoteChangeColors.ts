import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getQuoteChangeColors,
  isQuoteChangePositive,
  type QuoteChangeColors,
  type QuotesChangeColorConvention,
} from '@/domain/quotes/changeColorConvention';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  loadQuotesChangeColorConvention,
  subscribeQuotesChangeColorConventionChanged,
} from '@/services/quotesChangeColorPreference';

export function useQuoteChangeColors() {
  const { effectiveColorScheme } = useSignalTheme();
  const [convention, setConvention] = useState<QuotesChangeColorConvention | null>(null);

  const reload = useCallback(async () => {
    setConvention(await loadQuotesChangeColorConvention());
  }, []);

  useEffect(() => {
    void reload();
    return subscribeQuotesChangeColorConventionChanged(() => {
      void reload();
    });
  }, [reload]);

  const colors: QuoteChangeColors = useMemo(() => {
    const c = convention ?? 'korea';
    return getQuoteChangeColors(c, effectiveColorScheme);
  }, [convention, effectiveColorScheme]);

  const isPositive = useCallback(isQuoteChangePositive, []);

  const styleForQuote = useCallback(
    (q: { change?: unknown; changePercent?: unknown }) => ({
      color: isPositive(q) ? colors.up : colors.down,
    }),
    [colors.down, colors.up, isPositive],
  );

  return {
    convention,
    colors,
    isPositive,
    styleForQuote,
    ready: convention !== null,
  };
}
