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
  useSumTrailHint,
  type SumTrailCell,
  type SumTrailDifficulty,
  type SumTrailState,
} from '@/domain/games/sumTrail';
import {
  loadSumTrailHelpMode,
  saveSumTrailHelpMode,
  SUM_TRAIL_HELP_DEFAULT,
  type SumTrailHelpMode,
} from '@/services/sumTrailHelpPreference';

const DIFFICULTIES: SumTrailDifficulty[] = ['easy', 'normal', 'hard'];

type BoardFx = { id: number; kind: 'hit' | 'level' | 'fail'; points: number };

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
  kind,
  points,
  theme,
  sf,
  labelHit,
  labelLevel,
  labelFail,
  labelPoints,
}: {
  visible: boolean;
  kind: BoardFx['kind'];
  points: number;
  theme: AppTheme;
  sf: (n: number) => number;
  labelHit: string;
  labelLevel: string;
  labelFail: string;
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

  const isFail = kind === 'fail';
  const isLevel = kind === 'level';
  const holdMs = isFail || isLevel ? 900 : 520;
  const sparkMs = isFail || isLevel ? 700 : 480;

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
        Animated.delay(holdMs),
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
            duration: sparkMs,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ),
    ]).start();
  }, [visible, kind, holdMs, sparkMs, opacity, scale, sparkles]);

  if (!visible) return null;

  const accent = isFail ? theme.danger : theme.green;
  const accentAlt = theme.warning;
  const title = isFail ? labelFail : isLevel ? labelLevel : labelHit;
  const icon = isFail ? 'times-circle' : isLevel ? 'trophy' : 'check-circle';

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
        const dist = isFail || isLevel ? 56 : 42;
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
          burstStyles.card,
          {
            backgroundColor: isFail ? theme.danger : isLevel ? theme.green : theme.card,
            borderColor: isFail ? theme.danger : theme.greenBorder,
          },
        ]}>
        <FontAwesome
          name={icon}
          size={isFail || isLevel ? 28 : 22}
          color={isFail || isLevel ? '#FFFFFF' : theme.green}
        />
        <Text
          style={{
            marginTop: 6,
            fontSize: sf(isFail || isLevel ? 17 : 15),
            fontWeight: '800',
            color: isFail || isLevel ? '#FFFFFF' : theme.green,
            textAlign: 'center',
          }}>
          {title}
        </Text>
        {!isFail && points > 0 ? (
          <Text
            style={{
              marginTop: 2,
              fontSize: sf(13),
              fontWeight: '700',
              color: isLevel ? 'rgba(255,255,255,0.9)' : theme.warning,
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
  hinted,
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
  hinted: boolean;
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
    if (!selected && !hinted) return;
    scale.setValue(0.86);
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [selected, order, hinted, scale]);

  useEffect(() => {
    if (flashKey <= 0 || !selected) return;
    scale.setValue(1.12);
    Animated.spring(scale, { toValue: 1, friction: 3, tension: 100, useNativeDriver: true }).start();
  }, [flashKey, selected, scale]);

  if (empty) {
    return <View style={[cellStyles.cell, cellStyles.empty]} />;
  }

  let bg = tint.bg;
  let border = tint.border;
  let textColor = tint.text;
  if (selected) {
    bg = over ? theme.dangerDim : theme.greenDim;
    border = over ? theme.danger : theme.green;
    textColor = over ? theme.danger : theme.green;
  } else if (hinted) {
    bg = theme.warningDim;
    border = theme.warning;
    textColor = theme.warning;
  }

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
        ) : hinted ? (
          <View style={[cellStyles.badge, { backgroundColor: theme.warning }]}>
            <FontAwesome name="lightbulb-o" size={9} color="#FFFFFF" />
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

export function SumTrailGame({
  wide = false,
  split = false,
  viewportHeight = 800,
}: {
  wide?: boolean;
  split?: boolean;
  viewportHeight?: number;
}) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  /** 폰: 보드 우선 · 와이드 세로: 여유 · 스플릿: 사이드 열 */
  const compact = !wide && !split;
  const boardMax = split
    ? Math.max(360, Math.min(560, Math.floor(viewportHeight * 0.62)))
    : wide
      ? 480
      : Math.max(300, Math.min(392, Math.floor(viewportHeight * 0.42)));
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, wide, split, compact, boardMax),
    [theme, scaleFont, wide, split, compact, boardMax],
  );
  const [difficulty, setDifficulty] = useState<SumTrailDifficulty>('normal');
  const [state, setState] = useState<SumTrailState>(() => createSumTrailGame('normal'));
  const [boardFx, setBoardFx] = useState<BoardFx | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [helpMode, setHelpMode] = useState<SumTrailHelpMode>(SUM_TRAIL_HELP_DEFAULT);
  const fxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardPulse = useRef(new Animated.Value(1)).current;
  const boardShake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    void loadSumTrailHelpMode().then((mode) => {
      if (!cancelled) setHelpMode(mode);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setHelp = useCallback((mode: SumTrailHelpMode) => {
    setHelpMode(mode);
    void saveSumTrailHelpMode(mode);
  }, []);

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

  const playBoardShake = useCallback(() => {
    boardShake.setValue(0);
    Animated.sequence([
      Animated.timing(boardShake, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(boardShake, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(boardShake, { toValue: 6, duration: 45, useNativeDriver: true }),
      Animated.timing(boardShake, { toValue: -4, duration: 45, useNativeDriver: true }),
      Animated.timing(boardShake, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  }, [boardShake]);

  const triggerBoardFx = useCallback(
    (kind: BoardFx['kind'], points = 0) => {
      clearFxTimer();
      setFlashKey((n) => n + 1);
      if (kind === 'fail') playBoardShake();
      else playBoardPulse();
      setBoardFx({ id: Date.now(), kind, points });
      fxTimer.current = setTimeout(
        () => {
          setBoardFx(null);
          fxTimer.current = null;
        },
        kind === 'hit' ? 900 : 1400,
      );
    },
    [clearFxTimer, playBoardPulse, playBoardShake],
  );

  const onDifficulty = useCallback(
    (d: SumTrailDifficulty) => {
      clearFxTimer();
      setBoardFx(null);
      setDifficulty(d);
      setState(createSumTrailGame(d));
    },
    [clearFxTimer],
  );

  const onTapCell = useCallback(
    (cell: SumTrailCell) => {
      setState((prev) => {
        const next = tapSumTrailCell(prev, cell);
        if (next.status === 'failed' && prev.status !== 'failed') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          queueMicrotask(() => triggerBoardFx('fail'));
        } else if (next.clears > prev.clears || next.status === 'cleared') {
          const gained = next.score - prev.score;
          const kind = next.status === 'cleared' ? 'level' : 'hit';
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          queueMicrotask(() => triggerBoardFx(kind, gained));
        } else if (next.path.length > prev.path.length) {
          void Haptics.selectionAsync().catch(() => {});
        }
        return next;
      });
    },
    [triggerBoardFx],
  );

  const onHint = useCallback(() => {
    setState((prev) => {
      const next = useSumTrailHint(prev);
      if (next.status === 'failed' && prev.status !== 'failed') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        queueMicrotask(() => triggerBoardFx('fail'));
      } else if (next.hintsRemaining < prev.hintsRemaining) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      return next;
    });
  }, [triggerBoardFx]);

  const difficultyRow = (
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
      {!split && helpMode === 'hidden' ? (
        <Pressable
          onPress={() => setHelp('collapsed')}
          style={styles.helpShowBtn}
          accessibilityRole="button"
          accessibilityLabel={t('gameSumTrailHelpShowA11y')}>
          <FontAwesome name="question-circle" size={16} color={theme.green} />
        </Pressable>
      ) : null}
    </View>
  );

  const helpBand =
    split || helpMode === 'hidden' ? null : (
      <View style={[styles.heroBand, helpMode === 'collapsed' && styles.heroBandCollapsed]}>
        <Pressable
          onPress={() => setHelp(helpMode === 'expanded' ? 'collapsed' : 'expanded')}
          style={styles.helpToggle}
          accessibilityRole="button"
          accessibilityLabel={
            helpMode === 'expanded' ? t('gameSumTrailHelpCollapseA11y') : t('gameSumTrailHelpExpandA11y')
          }
          accessibilityState={{ expanded: helpMode === 'expanded' }}>
          <View style={styles.heroIcon}>
            <FontAwesome name="sitemap" size={compact ? 14 : 16} color={theme.green} />
          </View>
          <View style={styles.heroText}>
            <View style={styles.helpTitleRow}>
              <Text style={styles.kicker} numberOfLines={1}>
                {helpMode === 'collapsed' ? t('gameSumTrailHowTo') : t('gameSumTrailKicker')}
              </Text>
              <FontAwesome
                name={helpMode === 'expanded' ? 'chevron-up' : 'chevron-down'}
                size={11}
                color={theme.green}
              />
            </View>
            {helpMode === 'expanded' ? <Text style={styles.blurb}>{t('gameSumTrailBlurb')}</Text> : null}
          </View>
        </Pressable>
        <Pressable
          onPress={() => setHelp('hidden')}
          style={styles.helpHideBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('gameSumTrailHelpHideA11y')}>
          {helpMode === 'expanded' && !compact ? (
            <Text style={styles.helpHideText}>{t('gameSumTrailHelpHide')}</Text>
          ) : (
            <FontAwesome name="times" size={12} color={theme.textDim} />
          )}
        </Pressable>
      </View>
    );

  const splitHelp = (
    <>
      <Text style={styles.kicker}>{t('gameSumTrailKicker')}</Text>
      <Text style={styles.blurb}>{t('gameSumTrailBlurb')}</Text>
    </>
  );

  const statsBlock = (
    <>
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
    </>
  );

  const boardNode = (
    <Animated.View
      style={[
        styles.board,
        {
          transform: [{ scale: boardPulse }, { translateX: boardShake }],
          borderColor:
            state.status === 'failed'
              ? theme.danger
              : over
                ? theme.danger
                : near
                  ? theme.warning
                  : theme.greenBorder,
        },
      ]}>
      <BurstOverlay
        visible={boardFx != null}
        kind={boardFx?.kind ?? 'hit'}
        points={boardFx?.points ?? 0}
        theme={theme}
        sf={scaleFont}
        labelHit={t('gameSumTrailHitFx')}
        labelLevel={t('gameSumTrailCleared')}
        labelFail={t('gameSumTrailFailed')}
        labelPoints={t('gameSumTrailHitPoints', { points: boardFx?.points ?? 0 })}
      />
      {state.grid.map((row, r) => (
        <View key={`r-${r}`} style={styles.boardRow}>
          {row.map((value, c) => {
            const idx = pathMap.get(`${r},${c}`);
            const selected = idx != null;
            const empty = value <= 0;
            const hinted =
              !selected &&
              state.hintCell != null &&
              state.hintCell.r === r &&
              state.hintCell.c === c;
            return (
              <BoardCell
                key={`c-${r}-${c}`}
                value={value}
                selected={selected}
                order={idx}
                over={over}
                hinted={hinted}
                empty={empty}
                disabled={empty || state.status !== 'playing'}
                theme={theme}
                sf={scaleFont}
                wide={wide || split}
                flashKey={selected ? flashKey : 0}
                onPress={() => onTapCell({ r, c })}
                a11yLabel={
                  empty
                    ? t('gameSumTrailCellEmpty')
                    : hinted
                      ? t('gameSumTrailHintCellA11y', { value })
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
  );

  const statusOrActions =
    state.status === 'cleared' ? (
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
            setBoardFx(null);
            setState((s) => nextSumTrailLevel(s));
          }}
          accessibilityRole="button">
          <Text style={styles.primaryBtnText}>{t('gameSumTrailNextLevel')}</Text>
        </Pressable>
      </View>
    ) : state.status === 'failed' ? (
      <View style={styles.failBanner}>
        <View style={styles.winHeader}>
          <FontAwesome name="times-circle" size={18} color={theme.danger} />
          <Text style={styles.failTitle}>{t('gameSumTrailFailed')}</Text>
        </View>
        <Text style={styles.winBody}>{t('gameSumTrailFailedBody')}</Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => {
            clearFxTimer();
            setBoardFx(null);
            setState((s) => restartSumTrailLevel(s));
          }}
          accessibilityRole="button">
          <Text style={styles.primaryBtnText}>{t('gameSumTrailRestart')}</Text>
        </Pressable>
      </View>
    ) : (
      <View style={styles.actions}>
        <Pressable
          style={[
            styles.secondaryBtn,
            styles.hintBtn,
            state.hintsRemaining <= 0 && styles.hintBtnDisabled,
          ]}
          onPress={onHint}
          disabled={state.hintsRemaining <= 0}
          accessibilityRole="button"
          accessibilityLabel={t('gameSumTrailHintA11y', { count: state.hintsRemaining })}>
          <FontAwesome
            name="lightbulb-o"
            size={14}
            color={state.hintsRemaining > 0 ? theme.warning : theme.textDim}
          />
          <Text
            style={[
              styles.secondaryBtnText,
              state.hintsRemaining > 0 ? styles.hintBtnText : styles.hintBtnTextDisabled,
            ]}>
            {t('gameSumTrailHint', { count: state.hintsRemaining })}
          </Text>
        </Pressable>
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
            setBoardFx(null);
            setState((s) => restartSumTrailLevel(s));
          }}
          accessibilityRole="button">
          <Text style={styles.secondaryBtnText}>{t('gameSumTrailRestart')}</Text>
        </Pressable>
      </View>
    );

  if (split) {
    return (
      <View style={styles.splitRoot}>
        <View style={styles.boardColumn}>{boardNode}</View>
        <View style={styles.sideColumn}>
          {splitHelp}
          {difficultyRow}
          {statsBlock}
          {statusOrActions}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {helpBand}
      {difficultyRow}
      {statsBlock}
      {boardNode}
      {statusOrActions}
    </View>
  );
}


function makeStyles(
  theme: AppTheme,
  sf: (n: number) => number,
  wide: boolean,
  split: boolean,
  compact: boolean,
  boardMax: number,
) {
  const gap = compact ? 10 : wide ? 16 : 14;
  return StyleSheet.create({
    root: {
      gap,
    },
    splitRoot: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 24,
      flex: 1,
      minHeight: boardMax + 24,
    },
    boardColumn: {
      flex: 1.15,
      minWidth: 320,
      maxWidth: boardMax + 40,
      alignItems: 'center',
    },
    sideColumn: {
      flex: 1,
      minWidth: 280,
      maxWidth: 420,
      gap: 14,
      paddingTop: 4,
    },
    heroBand: {
      flexDirection: 'row',
      gap: compact ? 8 : 12,
      alignItems: 'flex-start',
      padding: compact ? 8 : wide ? 16 : 12,
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    heroBandCollapsed: {
      paddingVertical: compact ? 6 : 8,
      alignItems: 'center',
    },
    helpToggle: {
      flex: 1,
      flexDirection: 'row',
      gap: compact ? 8 : 12,
      alignItems: 'flex-start',
      minWidth: 0,
    },
    helpTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'nowrap',
    },
    helpHideBtn: {
      minWidth: 28,
      height: 28,
      paddingHorizontal: 6,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: compact ? 0 : 2,
    },
    helpHideText: {
      fontSize: sf(11),
      fontWeight: '600',
      color: theme.textDim,
    },
    helpShowBtn: {
      width: compact ? 34 : 38,
      height: compact ? 34 : 38,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 'auto',
    },
    heroIcon: {
      width: compact ? 28 : 32,
      height: compact ? 28 : 32,
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
      minWidth: 0,
    },
    kicker: {
      fontSize: sf(compact ? 12 : 13),
      fontWeight: '700',
      color: theme.green,
      letterSpacing: 0.3,
      flexShrink: 1,
    },
    blurb: {
      fontSize: sf(compact ? 12 : 13),
      lineHeight: sf(compact ? 17 : 18),
      color: theme.textMuted,
    },
    diffRow: {
      flexDirection: 'row',
      gap: compact ? 6 : 8,
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    diffChip: {
      paddingHorizontal: compact ? 10 : 12,
      paddingVertical: compact ? 7 : 8,
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
      fontSize: sf(compact ? 12 : 13),
      fontWeight: '600',
      color: theme.textMuted,
    },
    diffChipTextActive: {
      color: theme.green,
    },
    statsRow: {
      flexDirection: 'row',
      gap: compact ? 6 : 8,
    },
    statBox: {
      flex: 1,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingVertical: compact ? 8 : wide ? 14 : 10,
      paddingHorizontal: compact ? 6 : 8,
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
      fontSize: sf(compact ? 10 : 11),
      fontWeight: '600',
      color: theme.textDim,
    },
    statValue: {
      fontSize: sf(compact ? 16 : wide ? 20 : 18),
      fontWeight: '700',
      color: theme.text,
    },
    statValueFocus: {
      fontSize: sf(compact ? 20 : wide ? 26 : 22),
      fontWeight: '800',
      color: theme.green,
    },
    progressBlock: {
      gap: compact ? 4 : 6,
    },
    progressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    progressText: {
      fontSize: sf(compact ? 12 : 13),
      fontWeight: '600',
      color: theme.textMuted,
    },
    overSum: {
      color: theme.danger,
    },
    board: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: boardMax,
      gap: compact ? 5 : wide ? 8 : 6,
      padding: compact ? 8 : wide ? 14 : 10,
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1.5,
      backgroundColor: theme.bgElevated,
      overflow: 'hidden',
      position: 'relative',
    },
    boardRow: {
      flexDirection: 'row',
      gap: compact ? 5 : wide ? 8 : 6,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: compact ? 6 : 8,
    },
    secondaryBtn: {
      flexGrow: 1,
      minWidth: compact ? 88 : 96,
      paddingVertical: compact ? 10 : 12,
      paddingHorizontal: compact ? 10 : 12,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
    },
    hintBtn: {
      borderColor: theme.warning,
      backgroundColor: theme.warningDim,
    },
    hintBtnDisabled: {
      borderColor: theme.border,
      backgroundColor: theme.card,
      opacity: 0.55,
    },
    secondaryBtnText: {
      fontSize: sf(compact ? 12 : 13),
      fontWeight: '600',
      color: theme.text,
    },
    hintBtnText: {
      color: theme.warning,
    },
    hintBtnTextDisabled: {
      color: theme.textDim,
    },
    primaryBtn: {
      marginTop: 4,
      paddingVertical: compact ? 12 : 14,
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
      padding: compact ? 12 : 14,
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    failBanner: {
      gap: 6,
      padding: compact ? 12 : 14,
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1,
      borderColor: theme.danger,
      backgroundColor: theme.dangerDim,
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
    failTitle: {
      fontSize: sf(16),
      fontWeight: '800',
      color: theme.danger,
    },
    winBody: {
      fontSize: sf(compact ? 12 : 13),
      lineHeight: sf(compact ? 17 : 18),
      color: theme.textMuted,
    },
  });
}
