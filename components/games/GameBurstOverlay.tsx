import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { UI_RADIUS_CARD_LG } from '@/constants/uiCornerRadius';

export type GameBurstKind = 'hit' | 'level' | 'fail' | 'win' | 'hint';

type Props = {
  visible: boolean;
  kind: GameBurstKind;
  theme: AppTheme;
  sf: (n: number) => number;
  title: string;
  subtitle?: string;
  /** 큰 연출(레벨·완주·실패) */
  big?: boolean;
};

/** 게임 보드 위 버스트·스파클 오버레이 */
export function GameBurstOverlay({
  visible,
  kind,
  theme,
  sf,
  title,
  subtitle,
  big,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const sparkCount = big || kind === 'level' || kind === 'fail' || kind === 'win' ? 10 : 6;
  const sparkles = useRef(
    Array.from({ length: sparkCount }, (_, i) => ({
      angle: (i / sparkCount) * Math.PI * 2,
      anim: new Animated.Value(0),
    })),
  ).current;

  const isFail = kind === 'fail';
  const isBig = big || kind === 'level' || kind === 'win' || isFail;
  const holdMs = isFail || kind === 'level' || kind === 'win' ? 950 : kind === 'hint' ? 480 : 520;
  const sparkMs = isBig ? 720 : 480;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      scale.setValue(0.85);
      sparkles.forEach((s) => s.anim.setValue(0));
      return;
    }
    opacity.setValue(0);
    scale.setValue(0.68);
    sparkles.forEach((s) => s.anim.setValue(0));
    Animated.parallel([
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.delay(holdMs),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.06, duration: 220, useNativeDriver: true }),
      ]),
      Animated.stagger(
        32,
        sparkles.map((s) =>
          Animated.timing(s.anim, {
            toValue: 1,
            duration: sparkMs,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start();
  }, [visible, kind, holdMs, sparkMs, opacity, scale, sparkles]);

  if (!visible) return null;

  const accent = isFail ? theme.danger : kind === 'hint' ? theme.warning : theme.green;
  const accentAlt = theme.warning;
  const icon =
    kind === 'fail'
      ? 'times-circle'
      : kind === 'level' || kind === 'win'
        ? 'trophy'
        : kind === 'hint'
          ? 'lightbulb-o'
          : 'check-circle';

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { opacity, transform: [{ scale }] }]}>
      {sparkles.map((s, i) => {
        const dist = isBig ? 64 : kind === 'hint' ? 36 : 44;
        const tx = s.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(s.angle) * dist],
        });
        const ty = s.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(s.angle) * dist],
        });
        const sparkOpacity = s.anim.interpolate({
          inputRange: [0, 0.15, 1],
          outputRange: [0, 1, 0],
        });
        const size = i % 3 === 0 ? 10 : 7;
        return (
          <Animated.View
            key={i}
            style={[
              styles.spark,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: i % 2 === 0 ? accent : accentAlt,
                opacity: sparkOpacity,
                transform: [{ translateX: tx }, { translateY: ty }],
              },
            ]}
          />
        );
      })}
      <View
        style={[
          styles.card,
          {
            backgroundColor:
              isFail ? theme.danger : kind === 'win' || kind === 'level' ? theme.green : theme.card,
            borderColor: isFail ? theme.danger : theme.greenBorder,
          },
        ]}>
        <FontAwesome
          name={icon}
          size={isBig ? 30 : kind === 'hint' ? 20 : 22}
          color={isFail || kind === 'win' || kind === 'level' ? '#FFFFFF' : theme.green}
        />
        <Text
          style={{
            marginTop: 6,
            fontSize: sf(isBig ? 18 : 15),
            fontWeight: '800',
            color: isFail || kind === 'win' || kind === 'level' ? '#FFFFFF' : theme.green,
            textAlign: 'center',
          }}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              marginTop: 2,
              fontSize: sf(13),
              fontWeight: '700',
              color:
                isFail || kind === 'win' || kind === 'level'
                  ? 'rgba(255,255,255,0.92)'
                  : theme.warning,
            }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
  },
  card: {
    minWidth: 148,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: UI_RADIUS_CARD_LG,
    borderWidth: 1,
    alignItems: 'center',
  },
  spark: {
    position: 'absolute',
  },
});
