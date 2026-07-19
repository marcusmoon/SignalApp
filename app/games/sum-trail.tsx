import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SumTrailGame } from '@/components/games/SumTrailGame';
import { WideSubpaneHeader } from '@/components/layout/WideSubpaneHeader';
import { signalDrillStackOptions } from '@/components/layout/signalDrillStackOptions';
import {
  APP_CONTENT_MAX_WIDTH,
  APP_WIDE_CONTENT_MAX_WIDTH,
  wideContentFill,
} from '@/constants/responsiveLayout';
import {
  SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL,
  SCREEN_EMBEDDED_WIDE_PADDING_TOP,
  SCREEN_LIST_CONTENT_PADDING_TOP,
  SCREEN_WIDE_SCROLL_BOTTOM_BASE,
  stackScreenScrollBottomPadding,
} from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { webShellBackground } from '@/constants/webLayout';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

export type SumTrailScreenContentProps = {
  embedded?: boolean;
  onBack?: () => void;
};

/** 게임 → 합 트레일 */
export function SumTrailContent({ embedded = false, onBack }: SumTrailScreenContentProps) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const { useTwoPane } = useResponsiveLayout();
  const wide = embedded || useTwoPane;
  const styles = useMemo(() => makeStyles(theme, scaleFont, wide), [theme, scaleFont, wide]);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      {onBack ? <WideSubpaneHeader title={t('gameSumTrailTitle')} onBack={onBack} /> : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: wide ? SCREEN_EMBEDDED_WIDE_PADDING_TOP : SCREEN_LIST_CONTENT_PADDING_TOP,
            paddingBottom: wide
              ? SCREEN_WIDE_SCROLL_BOTTOM_BASE + insets.bottom
              : stackScreenScrollBottomPadding(insets.bottom),
            paddingHorizontal: wide ? SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL : 16,
          },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          <SumTrailGame wide={wide} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function SumTrailScreen() {
  const { t } = useLocale();
  const router = useRouter();
  const { useTwoPane } = useResponsiveLayout();

  if (useTwoPane) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, animation: 'none' }} />
        <SumTrailContent embedded onBack={() => router.back()} />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={signalDrillStackOptions({
          title: t('gameSumTrailTitle'),
          onBack: () => router.back(),
        })}
      />
      <SumTrailContent />
    </>
  );
}

function makeStyles(theme: AppTheme, _sf: (n: number) => number, wide: boolean) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: webShellBackground(theme.bg) },
    scroll: {
      flex: 1,
      width: '100%',
      ...(wide
        ? wideContentFill
        : { maxWidth: APP_CONTENT_MAX_WIDTH, alignSelf: 'center' as const }),
    },
    scrollContent: {
      width: '100%',
      maxWidth: wide ? APP_WIDE_CONTENT_MAX_WIDTH : APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    },
    inner: {
      width: '100%',
      maxWidth: wide ? 560 : APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    },
  });
}
