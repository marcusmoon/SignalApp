import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import type { AppTheme } from '@/constants/theme';
import { isWeb } from '@/constants/webLayout';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type FeedUpdatePromptPillProps = {
  message: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** 탭바 위 플로팅 chip·상단 prompt 배너가 공유하는 pill UI */
export function FeedUpdatePromptPill({ message, onPress, style }: FeedUpdatePromptPillProps) {
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makePromptStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.pill, pressed && styles.pressed, style]}
      accessibilityLabel={message}>
      <FontAwesome name="arrow-up" size={12} color={theme.green} />
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
  bottom: number;
};

/** 백그라운드 폴링으로 새 콘텐츠가 있을 때 탭바 위에 띄우는 공통 chip */
export function FeedNewContentChip({ visible, refreshing, message, onPress, bottom }: FeedNewContentChipProps) {
  if (!visible || refreshing) return null;

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View style={[styles.anchor, { bottom }]}>
        <FeedUpdatePromptPill message={message} onPress={onPress} style={styles.chipShadow} />
      </View>
    </View>
  );
}

function makePromptStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      maxWidth: 320,
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    pressed: {
      opacity: 0.9,
    },
    message: {
      minWidth: 0,
      flexShrink: 1,
      fontSize: sf(13),
      lineHeight: sf(17),
      color: theme.green,
      fontWeight: '900',
    },
  });
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 900,
    elevation: 20,
  },
  anchor: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    ...(isWeb
      ? {
          position: 'fixed' as never,
          zIndex: 2147483000,
        }
      : {}),
  },
  chipShadow: {
    ...(isWeb
      ? { boxShadow: '0 8px 24px rgba(25, 31, 40, 0.18)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.16,
          shadowRadius: 10,
          elevation: 8,
        }),
  },
});
