import { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SumTrailGame } from '@/components/games/SumTrailGame';
import { signalDrillStackOptions } from '@/components/layout/signalDrillStackOptions';
import { APP_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import { SCREEN_LIST_CONTENT_PADDING_TOP, stackScreenScrollBottomPadding } from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { webShellBackground } from '@/constants/webLayout';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

/** 게임센터 → 합 트레일 */
export default function SumTrailScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <Stack.Screen
        options={signalDrillStackOptions({
          title: t('gameSumTrailTitle'),
          onBack: () => router.back(),
        })}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP,
          paddingBottom: stackScreenScrollBottomPadding(insets.bottom),
          paddingHorizontal: 16,
        }}
        keyboardShouldPersistTaps="handled">
        <SumTrailGame />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, _sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: webShellBackground(theme.bg) },
    scroll: {
      flex: 1,
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    },
  });
}
