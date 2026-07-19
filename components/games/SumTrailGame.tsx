import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

function pathIndexMap(path: SumTrailCell[]): Map<string, number> {
  const m = new Map<string, number>();
  path.forEach((c, i) => m.set(`${c.r},${c.c}`, i + 1));
  return m;
}

export function SumTrailGame() {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const [difficulty, setDifficulty] = useState<SumTrailDifficulty>('normal');
  const [state, setState] = useState<SumTrailState>(() => createSumTrailGame('normal'));

  const pathMap = useMemo(() => pathIndexMap(state.path), [state.path]);
  const sum = currentPathSum(state);
  const over = sum > state.target && state.target > 0;

  const onDifficulty = useCallback((d: SumTrailDifficulty) => {
    setDifficulty(d);
    setState(createSumTrailGame(d));
  }, []);

  const onTapCell = useCallback((cell: SumTrailCell) => {
    setState((prev) => {
      const next = tapSumTrailCell(prev, cell);
      if (next.clears > prev.clears || next.status === 'cleared') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else if (next.path.length > prev.path.length) {
        void Haptics.selectionAsync().catch(() => {});
      }
      return next;
    });
  }, []);

  return (
    <View style={styles.root}>
      <Text style={styles.kicker}>{t('gameSumTrailKicker')}</Text>
      <Text style={styles.blurb}>{t('gameSumTrailBlurb')}</Text>

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
          <Text style={styles.statLabel}>{t('gameSumTrailLevel')}</Text>
          <Text style={styles.statValue}>{state.level}</Text>
        </View>
        <View style={[styles.statBox, styles.statBoxFocus]}>
          <Text style={styles.statLabel}>{t('gameSumTrailTarget')}</Text>
          <Text style={styles.statValueFocus}>{state.status === 'cleared' ? '—' : state.target}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>{t('gameSumTrailScore')}</Text>
          <Text style={styles.statValue}>{state.score}</Text>
        </View>
      </View>

      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {t('gameSumTrailClears', { clears: state.clears, needed: state.clearsNeeded })}
        </Text>
        <Text style={[styles.progressText, over && styles.overSum]}>
          {t('gameSumTrailPathSum', { sum })}
        </Text>
      </View>

      <View style={styles.board}>
        {state.grid.map((row, r) => (
          <View key={`r-${r}`} style={styles.boardRow}>
            {row.map((value, c) => {
              const idx = pathMap.get(`${r},${c}`);
              const selected = idx != null;
              const empty = value <= 0;
              return (
                <Pressable
                  key={`c-${r}-${c}`}
                  disabled={empty || state.status !== 'playing'}
                  onPress={() => onTapCell({ r, c })}
                  style={[
                    styles.cell,
                    empty && styles.cellEmpty,
                    selected && styles.cellSelected,
                    over && selected && styles.cellOver,
                  ]}
                  accessibilityRole="button"
                      accessibilityLabel={
                    empty
                      ? t('gameSumTrailCellEmpty')
                      : idx != null
                        ? t('gameSumTrailCellInPathA11y', { value, order: idx })
                        : t('gameSumTrailCellA11y', { value })
                  }>
                  {!empty ? (
                    <>
                      <Text style={[styles.cellText, selected && styles.cellTextSelected]}>
                        {value}
                      </Text>
                      {selected ? <Text style={styles.cellOrder}>{idx}</Text> : null}
                    </>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {state.status === 'cleared' ? (
        <View style={styles.winBanner}>
          <Text style={styles.winTitle}>{t('gameSumTrailCleared')}</Text>
          <Text style={styles.winBody}>{t('gameSumTrailClearedBody')}</Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => setState((s) => nextSumTrailLevel(s))}
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
            onPress={() => setState((s) => restartSumTrailLevel(s))}
            accessibilityRole="button">
            <Text style={styles.secondaryBtnText}>{t('gameSumTrailRestart')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    root: {
      gap: 14,
    },
    kicker: {
      fontSize: sf(13),
      fontWeight: '700',
      color: theme.green,
      letterSpacing: 0.3,
    },
    blurb: {
      fontSize: sf(14),
      lineHeight: sf(20),
      color: theme.textMuted,
      marginTop: -6,
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
      paddingVertical: 10,
      paddingHorizontal: 8,
      alignItems: 'center',
      gap: 2,
    },
    statBoxFocus: {
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    statLabel: {
      fontSize: sf(11),
      fontWeight: '600',
      color: theme.textDim,
    },
    statValue: {
      fontSize: sf(18),
      fontWeight: '700',
      color: theme.text,
    },
    statValueFocus: {
      fontSize: sf(22),
      fontWeight: '800',
      color: theme.green,
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
      maxWidth: 360,
      gap: 6,
      padding: 10,
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
    },
    boardRow: {
      flexDirection: 'row',
      gap: 6,
    },
    cell: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    cellEmpty: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    },
    cellSelected: {
      borderColor: theme.green,
      backgroundColor: theme.greenDim,
    },
    cellOver: {
      borderColor: theme.danger,
      backgroundColor: theme.dangerDim,
    },
    cellText: {
      fontSize: sf(20),
      fontWeight: '700',
      color: theme.text,
    },
    cellTextSelected: {
      color: theme.green,
    },
    cellOrder: {
      position: 'absolute',
      top: 3,
      right: 5,
      fontSize: sf(10),
      fontWeight: '700',
      color: theme.green,
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
