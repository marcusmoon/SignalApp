import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';

import type { AppTheme } from '@/constants/theme';
import { UI_RADIUS_CARD, UI_RADIUS_CARD_LG } from '@/constants/uiCornerRadius';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  clearSumTrailPath,
  createSumTrailGame,
  currentPathSum,
  nextSumTrailLevel,
  restartSumTrailLevel,
  tapSumTrailCell,
  undoSumTrailPath,
  type SumTrailCell,
  type SumTrailDifficulty,
  type SumTrailState,
} from '@/domain/games/sumTrail';

const DIFFICULTIES: SumTrailDifficulty[] = ['easy', 'normal', 'hard'];

type HitFx = { id: number; points: number; levelClear: boolean };

function pathIndexMap(path: SumTrailCell[]): Map<string, number> {
  const m = new Map<string, number>();
  path.forEach((c, i) => m.set(`${c.r},${c.c}`, i + 1));
  return m;
}

/** 숫자 1~9 → 타일 틴트 (테마 시맨틱만 사용) */
function digitTint(theme: AppTheme, value: number): { bg: string; border: string; text: string } {
  if (value <= 3) {
    return { bg: theme.bgElevated, border: theme.border, text: theme.textMuted };
  }
  if (value <= 6) {
    return { bg: theme.greenDim, border: theme.greenBorder, text: theme.green };
  }
  return { bg: theme.warningDim, border: theme.warning, text: theme.warning };
}

function ProgressBar({
  progress,
  over,
  theme,
}: {
  progress: number;
  over: boolean;
  theme: AppTheme;
}) {
  const width = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(width, {
      toValue: Math.max(0, Math.min(1, progress)),
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, width]);
  const barWidth = width.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  return (
    <View style={[progressStyles.track, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
      <Animated.View
        style={[
          progressStyles.fill,
          {
            width: barWidth,
            backgroundColor: over ? theme.danger : theme.green,
          },
        ]}
      />
    </View>
  );
}

const progressStyles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});

function BurstOverlay({
  visible,
  levelClear,
  points,
  theme,
  sf,
  labelHit,
  labelLevel,
  labelPoints,
}: {
  visible: boolean;
  levelClear: boolean;
  points: number;
  theme: AppTheme;
  sf: (n: number) => number;
  labelHit: string;
  labelLevel: string;
  labelPoints: string;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const sparkles = useRef(
    [0, 1, 2, 3, 4, 5].map((i) => ({
      angle: (i / 6) * Math.PI * 2,
      anim: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      scale.setValue(0.85);
      sparkles.forEach((s) => s.anim.setValue(0));
      return;
    }
    opacity.setValue(0);
    scale.setValue(0.7);
    sparkles.forEach((s) => s.anim.setValue(0));
    Animated.parallel([
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.delay(levelClear ? 900 : 520),
        Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.04, duration: 200, useNativeDriver: true }),
      ]),
      Animated.stagger(
        40,
        sparkles.map((s) =>
          Animated.timing(s.anim, {
            toValue: 1,
            duration: levelClear ? 700 : 480,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start();
  }, [visible, levelClear, opacity, scale, sparkles]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        burstStyles.wrap,
        {
          opacity,
          transform: [{ scale }],
        },
      ]}>
      {sparkles.map((s, i) => {
        const dist = levelClear ? 56 : 42;
        const tx = s.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(s.angle) * dist],
        });
        const ty = s.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(s.angle) * dist],
        });
        const sparkOpacity = s.anim.interpolate({
          inputRange: [0, 0.2, 1],
          outputRange: [0, 1, 0],
        });
        return (
          <Animated.View
            key={i}
            style={[
              burstStyles.spark,
              {
                backgroundColor: i % 2 === 0 ? theme.green : theme.warning,
                opacity: sparkOpacity,
                transform: [{ translateX: tx }, { translateY: ty }],
              },
            ]}
          />
        );
      })}
      <View
        style={[
          burstStyles.card,
          {
            backgroundColor: levelClear ? theme.green : theme.card,
            borderColor: theme.greenBorder,
          },
        ]}>
        <FontAwesome
          name={levelClear ? 'trophy' : 'check-circle'}
          size={levelClear ? 28 : 22}
          color={levelClear ? '#FFFFFF' : theme.green}
        />
        <Text
          style={{
            marginTop: 6,
            fontSize: sf(levelClear ? 17 : 15),
            fontWeight: '800',
            color: levelClear ? '#FFFFFF' : theme.green,
          }}>
          {levelClear ? labelLevel : labelHit}
        </Text>
        {points > 0 ? (
          <Text
            style={{
              marginTop: 2,
              fontSize: sf(13),
              fontWeight: '700',
              color: levelClear ? 'rgba(255,255,255,0.9)' : theme.warning,
            }}>
            {labelPoints}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const burstStyles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  card: {
    minWidth: 140,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: UI_RADIUS_CARD_LG,
    borderWidth: 1,
    alignItems: 'center',
  },
  spark: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

function BoardCell({
  value,
  selected,
  order,
  over,
  empty,
  disabled,
  theme,
  sf,
  wide,
  onPress,
  a11yLabel,
  flashKey,
}: {
  value: number;
  selected: boolean;
  order: number | undefined;
  over: boolean;
  empty: boolean;
  disabled: boolean;
  theme: AppTheme;
  sf: (n: number) => number;
  wide: boolean;
  onPress: () => void;
  a11yLabel: string;
  flashKey: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const tint = digitTint(theme, value);

  useEffect(() => {
    if (!selected) return;
    scale.setValue(0.86);
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [selected, order, scale]);

  useEffect(() => {
    if (flashKey <= 0 || !selected) return;
    scale.setValue(1.12);
    Animated.spring(scale, { toValue: 1, friction: 3, tension: 100, useNativeDriver: true }).start();
  }, [flashKey, selected, scale]);

  if (empty) {
    return <View style={[cellStyles.cell, cellStyles.empty]} />;
  }

  const bg = selected ? (over ? theme.dangerDim : theme.greenDim) : tint.bg;
  const border = selected ? (over ? theme.danger : theme.green) : tint.border;
  const textColor = selected ? (over ? theme.danger : theme.green) : tint.text;

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        style={[cellStyles.cell, { backgroundColor: bg, borderColor: border }]}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}>
        <Text style={{ fontSize: sf(wide ? 24 : 20), fontWeight: '800', color: textColor }}>{value}</Text>
        {selected ? (
          <View style={[cellStyles.badge, { backgroundColor: over ? theme.danger : theme.green }]}>
            <Text style={cellStyles.badgeText}>{order}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const cellStyles = StyleSheet.create({
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: UI_RADIUS_CARD,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  empty: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  badge: {
    position: 'absolute',
    top: 3,
    right: 3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

export function SumTrailGame({ wide = false }: { wide?: boolean }) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont, wide), [theme, scaleFont, wide]);
  const [difficulty, setDifficulty] = useState<SumTrailDifficulty>('normal');
  const [state, setState] = useState<SumTrailState>(() => createSumTrailGame('normal'));
  const [hitFx, setHitFx] = useState<HitFx | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const fxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardPulse = useRef(new Animated.Value(1)).current;

  const pathMap = useMemo(() => pathIndexMap(state.path), [state.path]);
  const sum = currentPathSum(state);
  const over = sum > state.target && state.target > 0;
  const progress = state.target > 0 ? sum / state.target : 0;
  const near = !over && progress >= 0.7 && sum > 0;

  const clearFxTimer = useCallback(() => {
    if (fxTimer.current) {
      clearTimeout(fxTimer.current);
      fxTimer.current = null;
    }
  }, []);

  useEffect(() => () => clearFxTimer(), [clearFxTimer]);

  const playBoardPulse = useCallback(() => {
    boardPulse.setValue(1);
    Animated.sequence([
      Animated.timing(boardPulse, { toValue: 1.03, duration: 100, useNativeDriver: true }),
      Animated.timing(boardPulse, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  }, [boardPulse]);

  const triggerHitFx = useCallback(
    (points: number, levelClear: boolean) => {
      clearFxTimer();
      setFlashKey((n) => n + 1);
      playBoardPulse();
      setHitFx({ id: Date.now(), points, levelClear });
      fxTimer.current = setTimeout(
        () => {
          setHitFx(null);
          fxTimer.current = null;
        },
        levelClear ? 1400 : 900,
      );
    },
    [clearFxTimer, playBoardPulse],
  );

  const onDifficulty = useCallback(
    (d: SumTrailDifficulty) => {
      clearFxTimer();
      setHitFx(null);
      setDifficulty(d);
      setState(createSumTrailGame(d));
    },
    [clearFxTimer],
  );

  const onTapCell = useCallback(
    (cell: SumTrailCell) => {
      setState((prev) => {
        const next = tapSumTrailCell(prev, cell);
        if (next.clears > prev.clears || next.status === 'cleared') {
          const gained = next.score - prev.score;
          const levelClear = next.status === 'cleared';
          void Haptics.notificationAsync(
            levelClear
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Success,
          ).catch(() => {});
          // defer fx so state commits first
          queueMicrotask(() => triggerHitFx(gained, levelClear));
        } else if (next.path.length > prev.path.length) {
          void Haptics.selectionAsync().catch(() => {});
        }
        return next;
      });
    },
    [triggerHitFx],
  );

  return (
    <View style={styles.root}>
      <View style={styles.heroBand}>
        <View style={styles.heroIcon}>
          <FontAwesome name="sitemap" size={16} color={theme.green} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.kicker}>{t('gameSumTrailKicker')}</Text>
          <Text style={styles.blurb}>{t('gameSumTrailBlurb')}</Text>
        </View>
      </View>

      <View style={styles.diffRow}>
        {DIFFICULTIES.map((d) => {
          const active = difficulty === d;
          const label =
            d === 'easy'
              ? t('gameSumTrailDiffEasy')
              : d === 'normal'
                ? t('gameSumTrailDiffNormal')
                : t('gameSumTrailDiffHard');
          return (
            <Pressable
              key={d}
              onPress={() => onDifficulty(d)}
              style={[styles.diffChip, active && styles.diffChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}>
              <Text style={[styles.diffChipText, active && styles.diffChipTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <FontAwesome name="flag" size={12} color={theme.textDim} />
          <Text style={styles.statLabel}>{t('gameSumTrailLevel')}</Text>
          <Text style={styles.statValue}>{state.level}</Text>
        </View>
        <View style={[styles.statBox, styles.statBoxFocus, near && styles.statBoxNear, over && styles.statBoxOver]}>
          <FontAwesome
            name="bullseye"
            size={14}
            color={over ? theme.danger : near ? theme.warning : theme.green}
          />
          <Text style={styles.statLabel}>{t('gameSumTrailTarget')}</Text>
          <Text
            style={[
              styles.statValueFocus,
              near && { color: theme.warning },
              over && { color: theme.danger },
            ]}>
            {state.status === 'cleared' ? '—' : state.target}
          </Text>
        </View>
        <View style={styles.statBox}>
          <FontAwesome name="star" size={12} color={theme.warning} />
          <Text style={styles.statLabel}>{t('gameSumTrailScore')}</Text>
          <Text style={styles.statValue}>{state.score}</Text>
        </View>
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            {t('gameSumTrailClears', { clears: state.clears, needed: state.clearsNeeded })}
          </Text>
          <Text
            style={[
              styles.progressText,
              near && { color: theme.warning },
              over && styles.overSum,
              sum === state.target && state.target > 0 && { color: theme.green },
            ]}>
            {t('gameSumTrailPathSum', { sum })}
          </Text>
        </View>
        <ProgressBar progress={progress} over={over} theme={theme} />
      </View>

      <Animated.View
        style={[
          styles.board,
          {
            transform: [{ scale: boardPulse }],
            borderColor: over ? theme.danger : near ? theme.warning : theme.greenBorder,
          },
        ]}>
        <BurstOverlay
          visible={hitFx != null}
          levelClear={hitFx?.levelClear === true}
          points={hitFx?.points ?? 0}
          theme={theme}
          sf={scaleFont}
          labelHit={t('gameSumTrailHitFx')}
          labelLevel={t('gameSumTrailCleared')}
          labelPoints={t('gameSumTrailHitPoints', { points: hitFx?.points ?? 0 })}
        />
        {state.grid.map((row, r) => (
          <View key={`r-${r}`} style={styles.boardRow}>
            {row.map((value, c) => {
              const idx = pathMap.get(`${r},${c}`);
              const selected = idx != null;
              const empty = value <= 0;
              return (
                <BoardCell
                  key={`c-${r}-${c}`}
                  value={value}
                  selected={selected}
                  order={idx}
                  over={over}
                  empty={empty}
                  disabled={empty || state.status !== 'playing'}
                  theme={theme}
                  sf={scaleFont}
                  wide={wide}
                  flashKey={selected ? flashKey : 0}
                  onPress={() => onTapCell({ r, c })}
                  a11yLabel={
                    empty
                      ? t('gameSumTrailCellEmpty')
                      : idx != null
                        ? t('gameSumTrailCellInPathA11y', { value, order: idx })
                        : t('gameSumTrailCellA11y', { value })
                  }
                />
              );
            })}
          </View>
        ))}
      </Animated.View>

      {state.status === 'cleared' ? (
        <View style={styles.winBanner}>
          <View style={styles.winHeader}>
            <FontAwesome name="trophy" size={18} color={theme.green} />
            <Text style={styles.winTitle}>{t('gameSumTrailCleared')}</Text>
          </View>
          <Text style={styles.winBody}>{t('gameSumTrailClearedBody')}</Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              clearFxTimer();
              setHitFx(null);
              setState((s) => nextSumTrailLevel(s));
            }}
            accessibilityRole="button">
            <Text style={styles.primaryBtnText}>{t('gameSumTrailNextLevel')}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => setState((s) => undoSumTrailPath(s))}
            accessibilityRole="button">
            <Text style={styles.secondaryBtnText}>{t('gameSumTrailUndo')}</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => setState((s) => clearSumTrailPath(s))}
            accessibilityRole="button">
            <Text style={styles.secondaryBtnText}>{t('gameSumTrailClearPath')}</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              clearFxTimer();
              setHitFx(null);
              setState((s) => restartSumTrailLevel(s));
            }}
            accessibilityRole="button">
            <Text style={styles.secondaryBtnText}>{t('gameSumTrailRestart')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, wide: boolean) {
  return StyleSheet.create({
    root: {
      gap: wide ? 16 : 14,
    },
    heroBand: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
      padding: wide ? 16 : 12,
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    heroIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    heroText: {
      flex: 1,
      gap: 4,
    },
    kicker: {
      fontSize: sf(13),
      fontWeight: '700',
      color: theme.green,
      letterSpacing: 0.3,
    },
    blurb: {
      fontSize: sf(13),
      lineHeight: sf(18),
      color: theme.textMuted,
    },
    diffRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    diffChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    diffChipActive: {
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    diffChipText: {
      fontSize: sf(13),
      fontWeight: '600',
      color: theme.textMuted,
    },
    diffChipTextActive: {
      color: theme.green,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    statBox: {
      flex: 1,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingVertical: wide ? 14 : 10,
      paddingHorizontal: 8,
      alignItems: 'center',
      gap: 2,
    },
    statBoxFocus: {
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    statBoxNear: {
      borderColor: theme.warning,
      backgroundColor: theme.warningDim,
    },
    statBoxOver: {
      borderColor: theme.danger,
      backgroundColor: theme.dangerDim,
    },
    statLabel: {
      fontSize: sf(11),
      fontWeight: '600',
      color: theme.textDim,
    },
    statValue: {
      fontSize: sf(wide ? 20 : 18),
      fontWeight: '700',
      color: theme.text,
    },
    statValueFocus: {
      fontSize: sf(wide ? 26 : 22),
      fontWeight: '800',
      color: theme.green,
    },
    progressBlock: {
      gap: 6,
    },
    progressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    progressText: {
      fontSize: sf(13),
      fontWeight: '600',
      color: theme.textMuted,
    },
    overSum: {
      color: theme.danger,
    },
    board: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: wide ? 480 : 360,
      gap: wide ? 8 : 6,
      padding: wide ? 14 : 10,
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1.5,
      backgroundColor: theme.bgElevated,
      overflow: 'hidden',
      position: 'relative',
    },
    boardRow: {
      flexDirection: 'row',
      gap: wide ? 8 : 6,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    secondaryBtn: {
      flexGrow: 1,
      minWidth: 96,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
    },
    secondaryBtnText: {
      fontSize: sf(13),
      fontWeight: '600',
      color: theme.text,
    },
    primaryBtn: {
      marginTop: 4,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: UI_RADIUS_CARD,
      backgroundColor: theme.green,
      alignItems: 'center',
    },
    primaryBtnText: {
      fontSize: sf(15),
      fontWeight: '700',
      color: '#FFFFFF',
    },
    winBanner: {
      gap: 6,
      padding: 14,
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    winHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    winTitle: {
      fontSize: sf(16),
      fontWeight: '800',
      color: theme.green,
    },
    winBody: {
      fontSize: sf(13),
      lineHeight: sf(18),
      color: theme.textMuted,
    },
  });
}
