import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { WideSubpaneHeader } from '@/components/layout/WideSubpaneHeader';
import { SymbolDetailPane } from '@/components/symbol/SymbolDetailPane';
import {
  SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL,
  SCREEN_EMBEDDED_WIDE_PADDING_TOP,
  SCREEN_WIDE_SCROLL_BOTTOM_BASE,
  stackScreenScrollBottomPadding,
} from '@/constants/screenLayout';
import { useLocale } from '@/contexts/LocaleContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

function normalizeTicker(raw: string | string[] | undefined): string {
  const first = Array.isArray(raw) ? raw[0] : raw;
  return String(first ?? '')
    .trim()
    .toUpperCase();
}

export type SymbolDetailContentProps = {
  ticker: string;
  embedded?: boolean;
  onBack?: () => void;
};

export function SymbolDetailContent({
  ticker,
  embedded = false,
  onBack,
}: SymbolDetailContentProps) {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const [screenTitle, setScreenTitle] = useState(() => ticker || t('screenSymbolDetail'));

  const onDisplayNameResolved = useCallback(
    (name: string) => {
      setScreenTitle(name || ticker || t('screenSymbolDetail'));
    },
    [t, ticker],
  );

  const bottomPad = embedded
    ? SCREEN_WIDE_SCROLL_BOTTOM_BASE + insets.bottom
    : stackScreenScrollBottomPadding(insets.bottom);

  return (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['bottom']}>
      {!embedded ? <Stack.Screen options={{ title: screenTitle }} /> : null}
      {onBack ? (
        <View style={styles.headerPad}>
          <WideSubpaneHeader title={screenTitle} onBack={onBack} />
        </View>
      ) : null}
      <View style={styles.root}>
        <SymbolDetailPane
          ticker={ticker}
          bottomPad={bottomPad}
          onDisplayNameResolved={onDisplayNameResolved}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  headerPad: {
    paddingHorizontal: SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL,
    paddingTop: SCREEN_EMBEDDED_WIDE_PADDING_TOP,
  },
  root: {
    flex: 1,
  },
});

export default function SymbolDetailScreen() {
  const { useTwoPane } = useResponsiveLayout();
  const { ticker: tickerParam } = useLocalSearchParams<{ ticker?: string | string[] }>();
  const ticker = useMemo(() => normalizeTicker(tickerParam), [tickerParam]);

  if (useTwoPane) {
    return (
      <WideOverlayRouteRedirect kind="symbol" params={ticker ? { ticker } : {}} />
    );
  }

  return <SymbolDetailContent ticker={ticker} />;
}
