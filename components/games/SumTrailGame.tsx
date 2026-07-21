import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';

import { SumTrailHelpSheet } from '@/components/games/SumTrailHelpSheet';
import { GameBurstOverlay } from '@/components/games/GameBurstOverlay';
import { runBoardPulse, runBoardShake, runCellPop, runCellPulse } from '@/components/games/gameBoardFx';
import type { AppTheme } from '@/constants/theme';
import { UI_RADIUS_CARD, UI_RADIUS_CARD_LG } from '@/constants/uiCornerRadius';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { recordSumTrailLevelCleared, recordSumTrailRunStarted } from '@/domain/games/records';
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
  clearSumTrailProgress,
  loadSumTrailProgress,
  saveSumTrailProgress,
} from '@/services/gameProgressStore';
import { updateGameRecords } from '@/services/gameRecordsStore';

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
    runCellPulse(scale);
  }, [selected, order, hinted, scale]);

  useEffect(() => {
    if (flashKey <= 0 || !selected) return;
    runCellPop(scale);
  }, [flashKey, selected, scale]);

  if (empty) {
    return <View style={[cellStyles.cell, cellStyles.empty, { flex: 1, alignSelf: 'stretch' }]} />;
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
    <Animated.View style={{ flex: 1, alignSelf: 'stretch', transform: [{ scale }] }}>
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
    alignSelf: 'stretch',
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
  fill = false,
  viewportHeight = 800,
}: {
  wide?: boolean;
  split?: boolean;
  /** 폰·세로: 가용 영역을 채워 보드를 최대화 */
  fill?: boolean;
  viewportHeight?: number;
}) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  /** 밀도: 폰만 컴팩트. fill은 보드 최대화와 별개 */
  const compact = !wide && !split;
  const [playArea, setPlayArea] = useState({ w: 0, h: 0 });
  const measuredBoard =
    playArea.w > 0 && playArea.h > 0
      ? Math.floor(Math.min(playArea.w, playArea.h))
      : 0;
  const fallbackBoard = split
    ? Math.max(360, Math.min(560, Math.floor(viewportHeight * 0.62)))
    : wide
      ? 480
      : Math.max(320, Math.min(420, Math.floor(viewportHeight * 0.48)));
  const boardMax = measuredBoard > 0 ? measuredBoard : fallbackBoard;
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, wide, split, compact, boardMax),
    [theme, scaleFont, wide, split, compact, boardMax],
  );
  const [difficulty, setDifficulty] = useState<SumTrailDifficulty>('normal');
  const [state, setState] = useState<SumTrailState>(() => createSumTrailGame('normal'));
  const [boardFx, setBoardFx] = useState<BoardFx | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const fxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardPulse = useRef(new Animated.Value(1)).current;
  const boardShake = useRef(new Animated.Value(0)).current;
  const targetGlow = useRef(new Animated.Value(0)).current;
  const recordedClearKey = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSumTrailProgress().then((progress) => {
      if (cancelled) return;
      if (progress) {
        setDifficulty(progress.difficulty);
        setState(progress.state);
      } else {
        void updateGameRecords((r) => recordSumTrailRunStarted(r));
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void saveSumTrailProgress(state);
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated || state.status !== 'cleared') return;
    const key = `${state.difficulty}:${state.level}:${state.score}`;
    if (recordedClearKey.current === key) return;
    recordedClearKey.current = key;
    void updateGameRecords((r) =>
      recordSumTrailLevelCleared(r, state.difficulty, state.level, state.score),
    );
  }, [hydrated, state.status, state.difficulty, state.level, state.score]);

  const pathMap = useMemo(() => pathIndexMap(state.path), [state.path]);
  const sum = currentPathSum(state);
  const over = sum > state.target && state.target > 0;
  const progress = state.target > 0 ? sum / state.target : 0;
  const near = !over && progress >= 0.7 && sum > 0;
  const largeCells = wide || split || boardMax >= 340;

  const clearFxTimer = useCallback(() => {
    if (fxTimer.current) {
      clearTimeout(fxTimer.current);
      fxTimer.current = null;
    }
  }, []);

  useEffect(() => () => clearFxTimer(), [clearFxTimer]);

  const playBoardPulse = useCallback(() => {
    runBoardPulse(boardPulse, 1.045);
  }, [boardPulse]);

  const playBoardShake = useCallback(() => {
    runBoardShake(boardShake, 9);
  }, [boardShake]);

  const onTarget = sum === state.target && state.target > 0 && state.status === 'playing';
  useEffect(() => {
    if (!onTarget) {
      targetGlow.setValue(0);
      return;
    }
    Animated.loop(
      Animated.sequence([
        Animated.timing(targetGlow, { toValue: 1, duration: 420, useNativeDriver: false }),
        Animated.timing(targetGlow, { toValue: 0.35, duration: 420, useNativeDriver: false }),
      ]),
    ).start();
    return () => targetGlow.stopAnimation();
  }, [onTarget, targetGlow]);

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
      recordedClearKey.current = null;
      void clearSumTrailProgress();
      void updateGameRecords((r) => recordSumTrailRunStarted(r));
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

  const onPlayAreaLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setPlayArea((prev) =>
      Math.abs(prev.w - width) < 1 && Math.abs(prev.h - height) < 1
        ? prev
        : { w: width, h: height },
    );
  }, []);

  const helpBtn = (
    <Pressable
      onPress={() => setHelpOpen(true)}
      style={styles.helpShowBtn}
      accessibilityRole="button"
      accessibilityLabel={t('gameSumTrailHelpShowA11y')}>
      <FontAwesome name="question-circle" size={16} color={theme.green} />
    </Pressable>
  );

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
      {helpBtn}
    </View>
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
          width: boardMax,
          height: boardMax,
          transform: [{ scale: boardPulse }, { translateX: boardShake }],
          borderColor:
            state.status === 'failed'
              ? theme.danger
              : over
                ? theme.danger
                : onTarget
                  ? targetGlow.interpolate({
                      inputRange: [0, 1],
                      outputRange: [theme.green, theme.warning],
                    })
                  : near
                    ? theme.warning
                    : theme.greenBorder,
          shadowColor: onTarget ? theme.green : 'transparent',
          shadowOpacity: onTarget
            ? targetGlow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.45] })
            : 0,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 0 },
        },
      ]}>
      <GameBurstOverlay
        visible={boardFx != null}
        kind={boardFx?.kind ?? 'hit'}
        theme={theme}
        sf={scaleFont}
        big={boardFx?.kind === 'level' || boardFx?.kind === 'fail'}
        title={
          boardFx?.kind === 'fail'
            ? t('gameSumTrailFailed')
            : boardFx?.kind === 'level'
              ? t('gameSumTrailCleared')
              : t('gameSumTrailHitFx')
        }
        subtitle={
          boardFx != null && boardFx.kind !== 'fail' && boardFx.points > 0
            ? t('gameSumTrailHitPoints', { points: boardFx.points })
            : undefined
        }
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
                wide={largeCells}
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

  const helpSheet = <SumTrailHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />;

  if (split) {
    return (
      <View style={styles.splitRoot}>
        <View style={styles.boardColumn} onLayout={onPlayAreaLayout}>
          {boardNode}
        </View>
        <View style={styles.sideColumn}>
          {difficultyRow}
          {statsBlock}
          {statusOrActions}
        </View>
        {helpSheet}
      </View>
    );
  }

  if (fill) {
    return (
      <View style={styles.fillRoot}>
        {difficultyRow}
        {statsBlock}
        <View style={styles.playArea} onLayout={onPlayAreaLayout}>
          {boardNode}
        </View>
        <View style={styles.footer}>{statusOrActions}</View>
        {helpSheet}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {difficultyRow}
      {statsBlock}
      <View style={styles.playAreaStacked} onLayout={onPlayAreaLayout}>
        {boardNode}
      </View>
      {statusOrActions}
      {helpSheet}
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
  const gap = compact ? 8 : wide ? 16 : 14;
  return StyleSheet.create({
    root: {
      gap,
    },
    fillRoot: {
      flex: 1,
      minHeight: 0,
      gap,
    },
    playArea: {
      flex: 1,
      minHeight: 0,
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    playAreaStacked: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: boardMax,
    },
    footer: {
      width: '100%',
    },
    splitRoot: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 24,
      flex: 1,
      minHeight: 0,
    },
    boardColumn: {
      flex: 1.15,
      minWidth: 280,
      minHeight: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sideColumn: {
      flex: 1,
      minWidth: 260,
      maxWidth: 420,
      gap: 12,
      paddingTop: 4,
      justifyContent: 'center',
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
      paddingVertical: compact ? 6 : wide ? 14 : 10,
      paddingHorizontal: compact ? 6 : 8,
      alignItems: 'center',
      gap: 1,
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
      width: boardMax,
      height: boardMax,
      maxWidth: '100%',
      flexShrink: 0,
      gap: compact ? 5 : wide ? 8 : 6,
      padding: compact ? 8 : wide ? 14 : 10,
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1.5,
      backgroundColor: theme.bgElevated,
      overflow: 'hidden',
      position: 'relative',
    },
    boardRow: {
      flex: 1,
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

