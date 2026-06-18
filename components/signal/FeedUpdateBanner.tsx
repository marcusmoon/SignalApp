import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

export type FeedUpdateBannerVariant = 'prompt' | 'notice';

type Props = {
  variant: FeedUpdateBannerVariant;
  message: string;
  onPress?: () => void;
};

/**
 * 새 콘텐츠 알림 — prompt(탭하여 새로고침) / notice(새로고침 후 확인).
 * 세그먼트 탭·필터 칩과 색·굵기로 구분한다.
 */
export function FeedUpdateBanner({ variant, message, onPress }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const isPrompt = variant === 'prompt';

  const content = (
    <>
      <View style={[styles.iconWrap, isPrompt ? styles.iconWrapPrompt : styles.iconWrapNotice]}>
        <FontAwesome
          name={isPrompt ? 'bell' : 'check'}
          size={isPrompt ? 14 : 11}
          color={isPrompt ? theme.accentOrange : '#FFFFFF'}
        />
      </View>
      <Text style={[styles.message, isPrompt ? styles.messagePrompt : styles.messageNotice]} numberOfLines={2}>
        {message}
      </Text>
      {isPrompt ? <FontAwesome name="chevron-up" size={12} color={theme.accentOrange} style={styles.chevron} /> : null}
    </>
  );

  if (isPrompt && onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.banner, styles.bannerPrompt, pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.banner, styles.bannerNotice]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      {content}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  const promptBorder =
    theme.accentOrange.startsWith('#') && theme.accentOrange.length === 7
      ? `${theme.accentOrange}66`
      : theme.accentOrange;

  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
    },
    bannerPrompt: {
      borderLeftWidth: 4,
      borderLeftColor: theme.accentOrange,
      borderColor: promptBorder,
      backgroundColor: theme.warningDim,
      ...(Platform.OS === 'ios'
        ? {
            shadowColor: theme.accentOrange,
            shadowOpacity: 0.18,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
          }
        : { elevation: 2 }),
    },
    bannerNotice: {
      borderLeftWidth: 4,
      borderLeftColor: theme.green,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    pressed: {
      opacity: 0.88,
    },
    iconWrap: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    iconWrapPrompt: {
      backgroundColor:
        theme.accentOrange.startsWith('#') && theme.accentOrange.length === 7
          ? `${theme.accentOrange}24`
          : theme.warningDim,
      borderWidth: 1,
      borderColor: promptBorder,
    },
    iconWrapNotice: {
      backgroundColor: theme.green,
    },
    message: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(13),
      lineHeight: sf(18),
    },
    messagePrompt: {
      color: theme.text,
      fontWeight: '900',
      letterSpacing: Platform.OS === 'ios' ? -0.25 : 0,
    },
    messageNotice: {
      color: theme.text,
      fontWeight: '800',
      letterSpacing: Platform.OS === 'ios' ? -0.2 : 0,
    },
    chevron: {
      flexShrink: 0,
      marginLeft: -2,
    },
  });
}
