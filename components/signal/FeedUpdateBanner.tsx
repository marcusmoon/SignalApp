import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { FeedUpdatePromptPill } from '@/components/signal/FeedNewContentChip';

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

  if (isPrompt && onPress) {
    return (
      <FeedUpdatePromptPill
        message={message}
        onPress={onPress}
        style={[styles.banner, styles.bannerPrompt]}
      />
    );
  }

  return (
    <View style={[styles.banner, styles.bannerNotice]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <FontAwesome name="check-circle" size={14} color={theme.green} />
      <Text style={[styles.message, styles.messageNotice]} numberOfLines={2}>
        {message}
      </Text>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
      marginBottom: 4,
    },
    bannerPrompt: {},
    bannerNotice: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    message: {
      minWidth: 0,
      fontSize: sf(13),
      lineHeight: sf(17),
    },
    messageNotice: {
      color: theme.green,
      fontWeight: '900',
      flex: 1,
    },
  });
}
