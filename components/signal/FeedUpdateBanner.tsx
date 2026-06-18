import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

export type FeedUpdateBannerVariant = 'prompt' | 'notice';

type Props = {
  variant: FeedUpdateBannerVariant;
  message: string;
  onPress?: () => void;
};

/** 새 콘텐츠 알림 — 기존 pill/notice 레이아웃 유지, 가독성만 약간 강조 */
export function FeedUpdateBanner({ variant, message, onPress }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const isPrompt = variant === 'prompt';

  const content = (
    <>
      <FontAwesome
        name={isPrompt ? 'arrow-up' : 'check-circle'}
        size={isPrompt ? 12 : 14}
        color={theme.green}
      />
      <Text style={[styles.message, isPrompt ? styles.messagePrompt : styles.messageNotice]} numberOfLines={2}>
        {message}
      </Text>
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
  const promptBg =
    theme.accentBlue.startsWith('#') && theme.accentBlue.length === 7
      ? `${theme.accentBlue}18`
      : theme.greenDim;

  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
      marginBottom: 4,
    },
    bannerPrompt: {
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: `${theme.accentBlue}66`,
      backgroundColor: promptBg,
    },
    bannerNotice: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    pressed: {
      opacity: 0.9,
    },
    message: {
      minWidth: 0,
      fontSize: sf(13),
      lineHeight: sf(17),
    },
    messagePrompt: {
      color: theme.accentBlue,
      fontWeight: '900',
      flexShrink: 1,
    },
    messageNotice: {
      color: theme.green,
      fontWeight: '900',
      flex: 1,
    },
  });
}
