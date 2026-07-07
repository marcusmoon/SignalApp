import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import type { AppTheme } from '@/constants/theme';
import { isWeb, WEB_SIGNAL_CSS } from '@/constants/webLayout';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type FeedUpdatePromptPillProps = {
  message: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** 상단 chip·배너가 공유하는 pill UI */
export function FeedUpdatePromptPill({ message, onPress, style }: FeedUpdatePromptPillProps) {
  const { theme, scaleFont } = useSignalTheme();
  const { styles, iconColor } = useMemo(() => makePromptStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.pill, pressed && styles.pressed, style]}
      accessibilityLabel={message}>
      <FontAwesome name="arrow-up" size={12} color={iconColor} />
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
    </Pressable>
  );
}

type FeedNewContentChipProps = {
  visible: boolean;
  refreshing?: boolean;
  message: string;
  onPress: () => void;
};

/** 백그라운드 폴링으로 새 콘텐츠가 있을 때 피드 상단(리스트 위)에 두는 chip */
export function FeedNewContentChip({ visible, refreshing, message, onPress }: FeedNewContentChipProps) {
  if (!visible || refreshing) return null;

  return (
    <FeedUpdatePromptPill
      message={message}
      onPress={onPress}
      style={stripStyles.strip}
    />
  );
}

function makePromptStyles(theme: AppTheme, sf: (n: number) => number) {
  const pillBg = isWeb ? WEB_SIGNAL_CSS.card : theme.card;
  const pillBorder = isWeb ? WEB_SIGNAL_CSS.green : theme.green;
  const pillText = isWeb ? WEB_SIGNAL_CSS.text : theme.text;
  const iconColor = isWeb ? WEB_SIGNAL_CSS.green : theme.green;

  const styles = StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: '100%',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: pillBorder,
      backgroundColor: pillBg,
    },
    pressed: {
      opacity: 0.92,
    },
    message: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(13),
      lineHeight: sf(18),
      color: pillText,
      fontWeight: '800',
      textAlign: 'center',
    },
  });

  return { styles, iconColor };
}

const stripStyles = StyleSheet.create({
  strip: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
});
