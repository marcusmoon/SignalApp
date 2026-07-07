import { useCallback, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import type { AppTheme } from '@/constants/theme';
import { isWeb, WEB_SIGNAL_CSS } from '@/constants/webLayout';
import { useWebDomPressFallback } from '@/hooks/useWebDomPressFallback';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type FeedUpdatePromptPillProps = {
  message: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  /** 탭바 위 플로팅 chip — 웹에서 CSS 고정 레이어·터치 fallback 적용 */
  webFloatingChip?: boolean;
};

/** 탭바 위 플로팅 chip·상단 prompt 배너가 공유하는 pill UI */
export function FeedUpdatePromptPill({ message, onPress, style, webFloatingChip }: FeedUpdatePromptPillProps) {
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makePromptStyles(theme, scaleFont), [theme, scaleFont]);
  const pillRef = useRef<View>(null);
  const lastPressAtRef = useRef(0);
  const webFloatingPillStyle = isWeb && webFloatingChip
    ? ({ cursor: 'pointer', touchAction: 'manipulation' } as never)
    : null;

  const iconColor = isWeb ? WEB_SIGNAL_CSS.green : theme.green;

  const triggerWebPress = useCallback(
    (event?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
      if (!webFloatingChip || !isWeb) return;
      if (Date.now() - lastPressAtRef.current < 250) return;
      event?.preventDefault?.();
      event?.stopPropagation?.();
      lastPressAtRef.current = Date.now();
      onPress();
    },
    [onPress, webFloatingChip],
  );

  useWebDomPressFallback(
    webFloatingChip ? pillRef : { current: null },
    '[data-signal-new-content-chip="true"]',
    triggerWebPress,
  );

  const webDataProps =
    isWeb && webFloatingChip
      ? ({
          dataSet: { signalNewContentChip: 'true' },
          onClick: triggerWebPress,
          onPointerUp: triggerWebPress,
        } as Record<string, unknown>)
      : undefined;

  return (
    <Pressable
      ref={webFloatingChip ? (pillRef as never) : undefined}
      onPress={onPress}
      onPressIn={isWeb && webFloatingChip ? triggerWebPress : undefined}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.pill,
        webFloatingPillStyle,
        pressed && styles.pressed,
        style,
      ]}
      accessibilityLabel={message}
      {...webDataProps}>
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
  bottom: number;
};

/** 백그라운드 폴링으로 새 콘텐츠가 있을 때 탭바 위에 띄우는 공통 chip */
export function FeedNewContentChip({ visible, refreshing, message, onPress, bottom }: FeedNewContentChipProps) {
  if (!visible || refreshing) return null;

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View style={[styles.anchor, { bottom }]}>
        <FeedUpdatePromptPill
          message={message}
          onPress={onPress}
          webFloatingChip
          style={styles.chipShadow}
        />
      </View>
    </View>
  );
}

function makePromptStyles(theme: AppTheme, sf: (n: number) => number) {
  const pillBg = isWeb ? WEB_SIGNAL_CSS.greenDim : theme.greenDim;
  const pillBorder = isWeb ? WEB_SIGNAL_CSS.greenBorder : theme.greenBorder;
  const pillText = isWeb ? WEB_SIGNAL_CSS.green : theme.green;

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
      borderColor: pillBorder,
      backgroundColor: pillBg,
    },
    pressed: {
      opacity: 0.9,
    },
    message: {
      minWidth: 0,
      flexShrink: 1,
      fontSize: sf(13),
      lineHeight: sf(17),
      color: pillText,
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
      ? { boxShadow: '0 8px 24px rgba(25, 31, 40, 0.2)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.16,
          shadowRadius: 10,
          elevation: 8,
        }),
  },
});
