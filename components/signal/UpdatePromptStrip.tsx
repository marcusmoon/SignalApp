import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import type { AppTheme } from '@/constants/theme';
import { isWeb, WEB_SIGNAL_CSS } from '@/constants/webLayout';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

const stripStyles = StyleSheet.create({
  strip: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
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

/** card 배경 + green 테두리 셸. onPress가 있으면 Pressable */
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

/** 단일 탭 액션 pill (새 콘텐츠 chip 등) */
export function FeedUpdatePromptPill({ message, onPress, style }: FeedUpdatePromptPillProps) {
  const { theme, scaleFont } = useSignalTheme();
  const { messageStyle, iconColor } = useMemo(() => makePillContentStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <UpdatePromptStrip style={style}>
      <UpdatePromptCard onPress={onPress} accessibilityLabel={message}>
        <View style={contentRowStyles.row}>
          <FontAwesome name="arrow-up" size={12} color={iconColor} />
          <Text style={messageStyle} numberOfLines={2}>
            {message}
          </Text>
        </View>
      </UpdatePromptCard>
    </UpdatePromptStrip>
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
      borderRadius: 8,
      borderWidth: 2,
      borderColor: cardBorder,
      backgroundColor: cardBg,
    },
    pressed: {
      opacity: 0.92,
    },
  });
}

function makePillContentStyles(theme: AppTheme, sf: (n: number) => number) {
  const pillText = isWeb ? WEB_SIGNAL_CSS.text : theme.text;
  const iconColor = isWeb ? WEB_SIGNAL_CSS.green : theme.green;

  return {
    iconColor,
    messageStyle: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(13),
      lineHeight: sf(18),
      color: pillText,
      fontWeight: '600' as const,
      textAlign: 'center' as const,
    },
  };
}

const contentRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
});
