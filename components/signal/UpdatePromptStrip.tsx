import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import type { AppTheme } from '@/constants/theme';
import { APP_CONTENT_SIDE_PADDING } from '@/constants/responsiveLayout';
import { UI_RADIUS_CARD } from '@/constants/uiCornerRadius';
import { isWeb, WEB_SIGNAL_CSS } from '@/constants/webLayout';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

const stripStyles = StyleSheet.create({
  strip: {
    width: '100%',
    paddingHorizontal: APP_CONTENT_SIDE_PADDING,
    paddingTop: 8,
    paddingBottom: 8,
  },
  /** 새 소식 chip — 가운데 compact pill용 strip (위·아래 균형) */
  chipStrip: {
    width: '100%',
    paddingHorizontal: APP_CONTENT_SIDE_PADDING,
    paddingTop: 6,
    paddingBottom: 6,
    alignItems: 'center',
  },
});

type UpdatePromptStripProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** 피드 chip·OTA 배너 등이 공유하는 상단 strip 여백 */
export function UpdatePromptStrip({ children, style }: UpdatePromptStripProps) {
  return <View style={[stripStyles.strip, style]}>{children}</View>;
}

type UpdatePromptCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** card 배경 + green 테두리 셸. onPress가 있으면 Pressable — OTA 등 강조용 */
export function UpdatePromptCard({ children, style, onPress, accessibilityLabel }: UpdatePromptCardProps) {
  const { theme } = useSignalTheme();
  const cardStyles = useMemo(() => makeCardStyles(theme), [theme]);

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [cardStyles.card, pressed && cardStyles.pressed, style]}>
        {children}
      </Pressable>
    );
  }

  return <View style={[cardStyles.card, style]}>{children}</View>;
}

type FeedUpdatePromptPillProps = {
  message: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * 새 소식 chip — OTA 풀폭 카드와 구분되는 compact pill.
 * 가운데 정렬 · hairline 테두리 · soft tint · 짧은 fade/slide 등장.
 */
export function FeedUpdatePromptPill({ message, onPress, style }: FeedUpdatePromptPillProps) {
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makePillStyles(theme, scaleFont), [theme, scaleFont]);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-6)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(-6);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <View style={[stripStyles.chipStrip, style]}>
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={message}
          style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
          <FontAwesome name="arrow-up" size={11} color={styles.iconColor} />
          <Text style={styles.message} numberOfLines={1}>
            {message}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function useUpdatePromptMessageStyle(align: 'center' | 'left' = 'center') {
  const { theme, scaleFont } = useSignalTheme();
  return useMemo(() => {
    const pillText = isWeb ? WEB_SIGNAL_CSS.text : theme.text;
    return {
      flex: 1,
      minWidth: 0,
      fontSize: scaleFont(13),
      lineHeight: scaleFont(18),
      color: pillText,
      fontWeight: '600' as const,
      textAlign: align,
    };
  }, [align, scaleFont, theme]);
}

function makeCardStyles(theme: AppTheme) {
  const cardBg = isWeb ? WEB_SIGNAL_CSS.card : theme.card;
  const cardBorder = isWeb ? WEB_SIGNAL_CSS.green : theme.green;

  return StyleSheet.create({
    card: {
      width: '100%',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 2,
      borderColor: cardBorder,
      backgroundColor: cardBg,
    },
    pressed: {
      opacity: 0.92,
    },
  });
}

function makePillStyles(theme: AppTheme, sf: (n: number) => number) {
  const pillText = isWeb ? WEB_SIGNAL_CSS.text : theme.text;
  const iconColor = isWeb ? WEB_SIGNAL_CSS.green : theme.green;
  const border = isWeb ? WEB_SIGNAL_CSS.green : theme.greenBorder;
  const fill = theme.greenDim;

  return {
    iconColor,
    pill: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      alignSelf: 'center' as const,
      gap: 8,
      maxWidth: '100%' as const,
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: border,
      backgroundColor: fill,
    },
    pressed: {
      opacity: 0.86,
    },
    message: {
      flexShrink: 1,
      fontSize: sf(12),
      lineHeight: sf(16),
      fontWeight: '600' as const,
      color: pillText,
    },
  };
}
