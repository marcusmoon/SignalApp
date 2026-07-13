import { useMemo } from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import developerAvatar from '@/assets/images/developer-avatar.png';
import { DEVELOPER_LINKEDIN_URL } from '@/constants/developer';
import { APP_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import { tabBarHorizontalMargin, tabBarPositionBottom, TAB_BAR_FLOAT_RADIUS } from '@/constants/tabBar';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

export const DEVELOPER_FOOTER_INNER_MIN_HEIGHT = 52;
export const DEVELOPER_FOOTER_COMPACT_INNER_MIN_HEIGHT = 40;

type DeveloperFooterDockProps = {
  /** iPad·넓은 웹: 하단 중앙 소형 캡슐 */
  compact?: boolean;
};

export function useDeveloperFooterLayout(compact = false) {
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    const bottom = compact ? Math.max(16, insets.bottom + 10) : tabBarPositionBottom(insets.bottom);
    const innerHeight = compact ? DEVELOPER_FOOTER_COMPACT_INNER_MIN_HEIGHT : DEVELOPER_FOOTER_INNER_MIN_HEIGHT;
    const scrollBottomPad = 32 + bottom + innerHeight + 12;
    return { bottom, innerHeight, scrollBottomPad };
  }, [compact, insets.bottom]);
}

export function DeveloperFooterDock({ compact = false }: DeveloperFooterDockProps) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const { width: winW } = useWindowDimensions();
  const { bottom } = useDeveloperFooterLayout(compact);
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const floatingFooterMarginH = tabBarHorizontalMargin();
  const floatingFooterWidth = Math.min(winW - floatingFooterMarginH * 2, APP_CONTENT_MAX_WIDTH);
  const floatingFooterLeft = Math.max(floatingFooterMarginH, (winW - floatingFooterWidth) / 2);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.dock,
        compact
          ? styles.dockCompact
          : {
              left: floatingFooterLeft,
              width: floatingFooterWidth,
            },
        { bottom },
      ]}>
      <View
        style={[
          styles.capsule,
          compact ? styles.capsuleCompact : styles.capsuleWide,
          Platform.OS === 'ios'
            ? {
                shadowColor: '#191F28',
                shadowOpacity: 0.08,
                shadowRadius: compact ? 12 : 18,
                shadowOffset: { width: 0, height: compact ? 4 : 8 },
              }
            : {
                shadowColor: '#191F28',
                shadowOffset: { width: 0, height: compact ? 2 : 4 },
                shadowOpacity: 0.1,
                shadowRadius: compact ? 10 : 14,
                elevation: compact ? 6 : 8,
              },
        ]}>
        <Pressable
          onPress={() => void Linking.openURL(DEVELOPER_LINKEDIN_URL)}
          style={({ pressed }) => [styles.press, compact && styles.pressCompact, pressed && { opacity: 0.88 }]}
          accessibilityRole="link"
          accessibilityLabel={t('settingsDeveloperLinkedInA11y')}>
          <Image
            source={developerAvatar}
            style={[styles.avatar, compact && styles.avatarCompact]}
            accessible={false}
            importantForAccessibility="no"
          />
          <Text style={[styles.text, !compact && styles.textWide]} numberOfLines={1}>
            {t('settingsDeveloperFooterLine')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    dock: {
      position: 'absolute',
      pointerEvents: 'box-none',
    },
    dockCompact: {
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    capsule: {
      borderRadius: TAB_BAR_FLOAT_RADIUS,
      overflow: 'hidden',
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    capsuleWide: {
      width: '100%',
    },
    capsuleCompact: {
      alignSelf: 'center',
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 999,
      maxWidth: '92%',
    },
    press: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    pressCompact: {
      gap: 16,
      paddingVertical: 10,
      paddingHorizontal: 12,
      alignSelf: 'center',
      flexGrow: 0,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 8,
    },
    avatarCompact: {
      width: 28,
      height: 28,
      borderRadius: 8,
    },
    text: {
      fontSize: sf(12),
      fontWeight: '600',
      color: theme.textMuted,
      letterSpacing: 0.2,
    },
    textWide: {
      flexShrink: 1,
    },
  });
}
