import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';

import { SudokuHelpSheet } from '@/components/games/SudokuHelpSheet';
import type { AppTheme } from '@/constants/theme';
import { UI_RADIUS_CARD, UI_RADIUS_CARD_LG } from '@/constants/uiCornerRadius';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  formatDurationMs,
  recordSudokuCleared,
  recordSudokuRunStarted,
} from '@/domain/games/records';
import {
  cellKey,
  clearSudokuCell,
  conflictSet,
  createSudokuGame,
  inputSudokuDigit,
  isGiven,
  newSudokuGame,
  relatedCells,
  restartSudoku,
  sameDigitCells,
  selectSudokuCell,
  undoSudoku,
  useSudokuHint,
  type SudokuDifficulty,
  type SudokuState,
} from '@/domain/games/sudoku';
import {
  clearSudokuProgress,
  loadSudokuProgress,
  saveSudokuProgress,
} from '@/services/gameProgressStore';
import { updateGameRecords } from '@/services/gameRecordsStore';

const DIFFICULTIES: SudokuDifficulty[] = ['easy', 'normal', 'hard'];
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export function SudokuGame({
  wide = false,
  split = false,
  fill = false,
  viewportHeight = 800,
}: {
  wide?: boolean;
  split?: boolean;
  fill?: boolean;
  viewportHeight?: number;
}) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const compact = !wide && !split;
  const [playArea, setPlayArea] = useState({ w: 0, h: 0 });
  const measuredBoard =
    playArea.w > 0 && playArea.h > 0
      ? Math.floor(Math.min(playArea.w, playArea.h))
      : 0;
  const fallbackBoard = split
    ? Math.max(360, Math.min(520, Math.floor(viewportHeight * 0.58)))
    : wide
      ? 440
      : Math.max(300, Math.min(400, Math.floor(viewportHeight * 0.46)));
  const boardMax = measuredBoard > 0 ? measuredBoard : fallbackBoard;
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, wide, compact, boardMax),
    [theme, scaleFont, wide, compact, boardMax],
  );

  const [difficulty, setDifficulty] = useState<SudokuDifficulty>('normal');
  const [state, setState] = useState<SudokuState>(() => createSudokuGame('normal'));
  const [helpOpen, setHelpOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedBaseRef = useRef(0);
  const tickBaseRef = useRef(Date.now());
  const recordedClearRef = useRef(false);

  const liveElapsed = useCallback(() => {
    if (state.status !== 'playing') return elapsedMs;
    return elapsedBaseRef.current + (Date.now() - tickBaseRef.current);
  }, [elapsedMs, state.status]);

  const beginTimer = useCallback((baseMs = 0) => {
    elapsedBaseRef.current = baseMs;
    tickBaseRef.current = Date.now();
    setElapsedMs(baseMs);
    recordedClearRef.current = false;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadSudokuProgress().then((progress) => {
      if (cancelled) return;
      if (progress) {
        setDifficulty(progress.difficulty);
        setState(progress.state);
        beginTimer(progress.elapsedMs);
      } else {
        beginTimer(0);
        void updateGameRecords((r) => recordSudokuRunStarted(r));
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [beginTimer]);

  useEffect(() => {
    if (!hydrated || state.status !== 'playing') return;
    const id = setInterval(() => {
      setElapsedMs(elapsedBaseRef.current + (Date.now() - tickBaseRef.current));
    }, 500);
    return () => clearInterval(id);
  }, [hydrated, state.status, difficulty]);

  useEffect(() => {
    if (!hydrated) return;
    const ms =
      state.status === 'playing'
        ? elapsedBaseRef.current + (Date.now() - tickBaseRef.current)
        : elapsedBaseRef.current;
    void saveSudokuProgress(state, ms);
  }, [state, hydrated]);

  useEffect(() => {
    if (!hydrated || state.status !== 'cleared' || recordedClearRef.current) return;
    recordedClearRef.current = true;
    const finalMs = liveElapsed();
    setElapsedMs(finalMs);
    void updateGameRecords((r) =>
      recordSudokuCleared(r, state.difficulty, finalMs, state.mistakes),
    );
    void clearSudokuProgress();
  }, [hydrated, state.status, state.difficulty, state.mistakes, liveElapsed]);

  const onDifficulty = useCallback(
    (d: SudokuDifficulty) => {
      setDifficulty(d);
      setState(newSudokuGame(d));
      beginTimer(0);
      void clearSudokuProgress();
      void updateGameRecords((r) => recordSudokuRunStarted(r));
    },
    [beginTimer],
  );

  const conflicts = useMemo(() => conflictSet(state.grid), [state.grid]);
  const related = useMemo(
    () => (state.selected ? relatedCells(state.selected) : new Set<string>()),
    [state.selected],
  );
  const selectedValue =
    state.selected != null ? state.grid[state.selected.r]![state.selected.c]! : 0;
  const sameDigits = useMemo(
    () => sameDigitCells(state.grid, selectedValue),
    [state.grid, selectedValue],
  );

  const onPlayAreaLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setPlayArea((prev) =>
      Math.abs(prev.w - width) < 1 && Math.abs(prev.h - height) < 1
        ? prev
        : { w: width, h: height },
    );
  }, []);

  const onSelect = useCallback((r: number, c: number) => {
    setState((prev) => selectSudokuCell(prev, { r, c }));
    void Haptics.selectionAsync().catch(() => {});
  }, []);

  const onDigit = useCallback((digit: number) => {
    setState((prev) => {
      const next = inputSudokuDigit(prev, digit);
      if (next.status === 'cleared' && prev.status !== 'cleared') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else if (next.mistakes > prev.mistakes) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      } else if (next.grid !== prev.grid) {
        void Haptics.selectionAsync().catch(() => {});
      }
      return next;
    });
  }, []);

  const onHint = useCallback(() => {
    setState((prev) => {
      const next = useSudokuHint(prev);
      if (next.hintsRemaining < prev.hintsRemaining) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      return next;
    });
  }, []);

  const difficultyRow = (
    <View style={styles.diffRow}>
      {DIFFICULTIES.map((d) => {
        const active = difficulty === d;
        const label =
          d === 'easy'
            ? t('gameSudokuDiffEasy')
            : d === 'normal'
              ? t('gameSudokuDiffNormal')
              : t('gameSudokuDiffHard');
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
      <Pressable
        onPress={() => setHelpOpen(true)}
        style={styles.helpShowBtn}
        accessibilityRole="button"
        accessibilityLabel={t('gameSudokuHelpShowA11y')}>
        <FontAwesome name="question-circle" size={16} color={theme.green} />
      </Pressable>
    </View>
  );

  const statsBlock = (
    <View style={styles.statsRow}>
      <View style={styles.statBox}>
        <FontAwesome name="clock-o" size={12} color={theme.textDim} />
        <Text style={styles.statLabel}>{t('gameSudokuTime')}</Text>
        <Text style={styles.statValue}>{formatDurationMs(elapsedMs)}</Text>
      </View>
      <View style={styles.statBox}>
        <FontAwesome name="times-circle" size={12} color={theme.danger} />
        <Text style={styles.statLabel}>{t('gameSudokuMistakes')}</Text>
        <Text style={styles.statValue}>{state.mistakes}</Text>
      </View>
      <View style={[styles.statBox, styles.statBoxFocus]}>
        <FontAwesome name="lightbulb-o" size={12} color={theme.warning} />
        <Text style={styles.statLabel}>{t('gameSudokuHints')}</Text>
        <Text style={[styles.statValue, { color: theme.warning }]}>{state.hintsRemaining}</Text>
      </View>
    </View>
  );

  const boardNode = (
    <View style={[styles.board, { width: boardMax, height: boardMax }]}>
      {state.grid.map((row, r) => (
        <View key={`r-${r}`} style={[styles.boardRow, r % 3 === 0 && r > 0 && styles.bandH]}>
          {row.map((value, c) => {
            const key = cellKey({ r, c });
            const given = isGiven(state.puzzle, { r, c });
            const selected =
              state.selected != null && state.selected.r === r && state.selected.c === c;
            const conflict = conflicts.has(key);
            const inRelated = related.has(key);
            const same = sameDigits.has(key) && value > 0;
            return (
              <Pressable
                key={key}
                onPress={() => onSelect(r, c)}
                style={[
                  styles.cell,
                  c % 3 === 0 && c > 0 && styles.bandV,
                  inRelated && styles.cellRelated,
                  same && styles.cellSame,
                  selected && styles.cellSelected,
                  conflict && styles.cellConflict,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  value > 0
                    ? t('gameSudokuCellA11y', { value, row: r + 1, col: c + 1 })
                    : t('gameSudokuCellEmptyA11y', { row: r + 1, col: c + 1 })
                }>
                {value > 0 ? (
                  <Text
                    style={[
                      styles.cellText,
                      given && styles.cellTextGiven,
                      !given && styles.cellTextUser,
                      conflict && styles.cellTextConflict,
                    ]}>
                    {value}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );

  const numberPad = (
    <View style={styles.pad}>
      {DIGITS.map((d) => (
        <Pressable
          key={d}
          onPress={() => onDigit(d)}
          disabled={state.status !== 'playing'}
          style={[styles.padBtn, state.status !== 'playing' && styles.padBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel={t('gameSudokuDigitA11y', { digit: d })}>
          <Text style={styles.padBtnText}>{d}</Text>
        </Pressable>
      ))}
    </View>
  );

  const statusOrActions =
    state.status === 'cleared' ? (
      <View style={styles.winBanner}>
        <View style={styles.winHeader}>
          <FontAwesome name="trophy" size={18} color={theme.green} />
          <Text style={styles.winTitle}>{t('gameSudokuCleared')}</Text>
        </View>
        <Text style={styles.winBody}>{t('gameSudokuClearedBody')}</Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => {
            setState(newSudokuGame(difficulty));
            beginTimer(0);
            void clearSudokuProgress();
            void updateGameRecords((r) => recordSudokuRunStarted(r));
          }}
          accessibilityRole="button">
          <Text style={styles.primaryBtnText}>{t('gameSudokuNewGame')}</Text>
        </Pressable>
      </View>
    ) : (
      <View style={styles.actionsCol}>
        {numberPad}
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
            accessibilityLabel={t('gameSudokuHintA11y', { count: state.hintsRemaining })}>
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
              {t('gameSudokuHint', { count: state.hintsRemaining })}
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => setState((s) => clearSudokuCell(s))}
            accessibilityRole="button">
            <Text style={styles.secondaryBtnText}>{t('gameSudokuErase')}</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => setState((s) => undoSudoku(s))}
            accessibilityRole="button">
            <Text style={styles.secondaryBtnText}>{t('gameSudokuUndo')}</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              setState((s) => restartSudoku(s));
              beginTimer(0);
            }}
            accessibilityRole="button">
            <Text style={styles.secondaryBtnText}>{t('gameSudokuRestart')}</Text>
          </Pressable>
        </View>
      </View>
    );

  const helpSheet = <SudokuHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />;

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
  compact: boolean,
  boardMax: number,
) {
  const gap = compact ? 8 : wide ? 14 : 12;
  return StyleSheet.create({
    root: { gap },
    fillRoot: { flex: 1, minHeight: 0, gap },
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
    footer: { width: '100%' },
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
      paddingVertical: compact ? 6 : wide ? 12 : 8,
      paddingHorizontal: 6,
      alignItems: 'center',
      gap: 1,
    },
    statBoxFocus: {
      borderColor: theme.warning,
      backgroundColor: theme.warningDim,
    },
    statLabel: {
      fontSize: sf(compact ? 10 : 11),
      fontWeight: '600',
      color: theme.textDim,
    },
    statValue: {
      fontSize: sf(compact ? 15 : wide ? 18 : 16),
      fontWeight: '700',
      color: theme.text,
    },
    board: {
      alignSelf: 'center',
      flexShrink: 0,
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 2,
      borderColor: theme.textMuted,
      backgroundColor: theme.bgElevated,
      overflow: 'hidden',
    },
    boardRow: {
      flex: 1,
      flexDirection: 'row',
    },
    bandH: {
      borderTopWidth: 2,
      borderTopColor: theme.textMuted,
    },
    bandV: {
      borderLeftWidth: 2,
      borderLeftColor: theme.textMuted,
    },
    cell: {
      flex: 1,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    cellRelated: {
      backgroundColor: theme.bgElevated,
    },
    cellSame: {
      backgroundColor: theme.greenDim,
    },
    cellSelected: {
      backgroundColor: theme.greenDim,
      borderColor: theme.green,
      borderWidth: 1.5,
    },
    cellConflict: {
      backgroundColor: theme.dangerDim,
    },
    cellText: {
      fontSize: sf(compact ? 16 : wide ? 22 : 18),
      fontWeight: '700',
    },
    cellTextGiven: {
      color: theme.text,
    },
    cellTextUser: {
      color: theme.green,
    },
    cellTextConflict: {
      color: theme.danger,
    },
    pad: {
      flexDirection: 'row',
      flexWrap: 'nowrap',
      gap: compact ? 4 : 6,
    },
    padBtn: {
      flex: 1,
      minWidth: 0,
      paddingVertical: compact ? 10 : 12,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    padBtnDisabled: {
      opacity: 0.45,
    },
    padBtnText: {
      fontSize: sf(compact ? 15 : 17),
      fontWeight: '700',
      color: theme.text,
    },
    actionsCol: {
      gap: compact ? 8 : 10,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: compact ? 6 : 8,
    },
    secondaryBtn: {
      flexGrow: 1,
      minWidth: compact ? 72 : 84,
      paddingVertical: compact ? 10 : 12,
      paddingHorizontal: compact ? 8 : 10,
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
      fontSize: sf(compact ? 12 : 13),
      lineHeight: sf(compact ? 17 : 18),
      color: theme.textMuted,
    },
  });
}
