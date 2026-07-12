import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SymbolDetailPane } from '@/components/symbol/SymbolDetailPane';
import { stackScreenScrollBottomPadding } from '@/constants/screenLayout';
import { useLocale } from '@/contexts/LocaleContext';

function normalizeTicker(raw: string | string[] | undefined): string {
  const first = Array.isArray(raw) ? raw[0] : raw;
  return String(first ?? '')
    .trim()
    .toUpperCase();
}

export default function SymbolDetailScreen() {
  const { ticker: tickerParam } = useLocalSearchParams<{ ticker?: string | string[] }>();
  const ticker = useMemo(() => normalizeTicker(tickerParam), [tickerParam]);
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const [screenTitle, setScreenTitle] = useState(() => ticker || t('screenSymbolDetail'));

  const onDisplayNameResolved = useCallback((name: string) => {
    setScreenTitle(name || ticker || t('screenSymbolDetail'));
  }, [t, ticker]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: screenTitle }} />
      <View style={styles.root}>
        <SymbolDetailPane
          ticker={ticker}
          bottomPad={stackScreenScrollBottomPadding(insets.bottom)}
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
  root: {
    flex: 1,
  },
});
