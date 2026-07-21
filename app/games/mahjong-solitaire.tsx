import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MahjongSolitaireGame } from '@/components/games/MahjongSolitaireGame';
import { WideSubpaneHeader } from '@/components/layout/WideSubpaneHeader';
import { signalDrillStackOptions } from '@/components/layout/signalDrillStackOptions';
import {
  APP_CONTENT_MAX_WIDTH,
  APP_WIDE_CONTENT_MAX_WIDTH,
  SIDEBAR_WIDTH,
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

export type MahjongScreenContentProps = {
  embedded?: boolean;
  onBack?: () => void;
};

export function MahjongSolitaireContent({ embedded = false, onBack }: MahjongScreenContentProps) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const { useTwoPane, width, height, isLandscape } = useResponsiveLayout();
  const wide = embedded || useTwoPane;
  const split = wide && (isLandscape || width - SIDEBAR_WIDTH >= 900);
  const styles = useMemo(() => makeStyles(theme, scaleFont, wide), [theme, scaleFont, wide]);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      {onBack ? <WideSubpaneHeader title={t('gameMahjongTitle')} onBack={onBack} /> : null}
      <View
        style={[
          styles.fill,
          {
            paddingTop: wide ? SCREEN_EMBEDDED_WIDE_PADDING_TOP : SCREEN_LIST_CONTENT_PADDING_TOP,
            paddingBottom: wide
              ? SCREEN_WIDE_SCROLL_BOTTOM_BASE + insets.bottom
              : stackScreenScrollBottomPadding(insets.bottom),
            paddingHorizontal: wide ? SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL : 16,
          },
        ]}>
        <View style={styles.inner}>
          <MahjongSolitaireGame wide={wide} split={split} fill viewportHeight={height} />
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function MahjongSolitaireScreen() {
  const { t } = useLocale();
  const router = useRouter();
  const { useTwoPane } = useResponsiveLayout();

  if (useTwoPane) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, animation: 'none' }} />
        <MahjongSolitaireContent
          embedded
          onBack={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/game-center' as never);
          }}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={signalDrillStackOptions({
          title: t('gameMahjongTitle'),
          onBack: () => router.back(),
        })}
      />
      <MahjongSolitaireContent />
    </>
  );
}

function makeStyles(theme: AppTheme, _sf: (n: number) => number, wide: boolean) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: webShellBackground(theme.bg) },
    fill: {
      flex: 1,
      width: '100%',
      minHeight: 0,
      ...(wide
        ? wideContentFill
        : { maxWidth: APP_CONTENT_MAX_WIDTH, alignSelf: 'center' as const }),
    },
    inner: {
      flex: 1,
      minHeight: 0,
      width: '100%',
      maxWidth: wide ? APP_WIDE_CONTENT_MAX_WIDTH : APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    },
  });
}
