import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BOTTOM_SHEET_BACKDROP_COLOR,
  BOTTOM_SHEET_MAX_HEIGHT,
  BOTTOM_SHEET_SCROLL_STYLE,
} from '@/constants/bottomSheetLayout';
import type { AppTheme } from '@/constants/theme';
import { UI_RADIUS_CARD, UI_RADIUS_SHEET } from '@/constants/uiCornerRadius';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  emptyGameRecords,
  formatDurationMs,
  type GameRecordsState,
} from '@/domain/games/records';
import { loadGameRecords, subscribeGameRecordsChanged } from '@/services/gameRecordsStore';

type Props = {
  visible: boolean;
  onClose: () => void;
};

/** 게임 통산 기록 바텀 시트 */
export function GameRecordsSheet({ visible, onClose }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const [records, setRecords] = useState<GameRecordsState>(emptyGameRecords);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void loadGameRecords().then((r) => {
      if (!cancelled) setRecords(r);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    return subscribeGameRecordsChanged(() => {
      void loadGameRecords().then(setRecords);
    });
  }, []);

  const st = records.sumTrail;
  const su = records.sudoku;
  const bp = records.blockPuzzle;
  const mj = records.mahjong;

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('filterSheetDismissA11y')}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <View style={styles.grab} />
          <View style={styles.head}>
            <Text style={styles.title} numberOfLines={2}>
              {t('gameRecordsTitle')}
            </Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('filterSheetDone')}>
              <FontAwesome name="times" size={18} color={theme.textMuted} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            <Text style={styles.section}>{t('gameSumTrailTitle')}</Text>
            <View style={styles.card}>
              <Row label={t('gameRecordsRuns')} value={String(st.runsStarted)} styles={styles} />
              <Row
                label={t('gameRecordsLevelsCleared')}
                value={String(st.levelsCleared)}
                styles={styles}
              />
              <Row label={t('gameRecordsBestLevel')} value={String(st.bestLevel)} styles={styles} />
              <Row label={t('gameRecordsBestScore')} value={String(st.bestScore)} styles={styles} />
            </View>

            <Text style={styles.section}>{t('gameSudokuTitle')}</Text>
            <View style={styles.card}>
              <Row label={t('gameRecordsRuns')} value={String(su.runsStarted)} styles={styles} />
              <Row label={t('gameRecordsClears')} value={String(su.clears)} styles={styles} />
              {(['easy', 'normal', 'hard'] as const).map((d) => {
                const row = su.byDifficulty[d];
                const diffLabel =
                  d === 'easy'
                    ? t('gameSudokuDiffEasy')
                    : d === 'normal'
                      ? t('gameSudokuDiffNormal')
                      : t('gameSudokuDiffHard');
                const time =
                  row.bestTimeMs != null ? formatDurationMs(row.bestTimeMs) : t('gameRecordsEmpty');
                const miss =
                  row.bestMistakes != null ? String(row.bestMistakes) : t('gameRecordsEmpty');
                return (
                  <View key={d} style={styles.diffBlock}>
                    <Text style={styles.diffTitle}>{diffLabel}</Text>
                    <Row
                      label={t('gameRecordsClears')}
                      value={String(row.clears)}
                      styles={styles}
                      compact
                    />
                    <Row label={t('gameRecordsBestTime')} value={time} styles={styles} compact />
                    <Row
                      label={t('gameRecordsBestMistakes')}
                      value={miss}
                      styles={styles}
                      compact
                    />
                  </View>
                );
              })}
            </View>
            <Text style={styles.section}>{t('gameBlockPuzzleTitle')}</Text>
            <View style={styles.card}>
              <Row label={t('gameRecordsRuns')} value={String(bp.runsStarted)} styles={styles} />
              <Row label={t('gameRecordsBestScore')} value={String(bp.bestScore)} styles={styles} />
              <Row label={t('gameRecordsBestLines')} value={String(bp.bestLines)} styles={styles} />
              {(['easy', 'normal', 'hard'] as const).map((d) => {
                const row = bp.byDifficulty[d];
                const diffLabel =
                  d === 'easy'
                    ? t('gameBlockPuzzleDiffEasy')
                    : d === 'normal'
                      ? t('gameBlockPuzzleDiffNormal')
                      : t('gameBlockPuzzleDiffHard');
                return (
                  <View key={d} style={styles.diffBlock}>
                    <Text style={styles.diffTitle}>{diffLabel}</Text>
                    <Row
                      label={t('gameRecordsBestScore')}
                      value={String(row.bestScore)}
                      styles={styles}
                      compact
                    />
                    <Row
                      label={t('gameRecordsBestLines')}
                      value={String(row.bestLines)}
                      styles={styles}
                      compact
                    />
                    <Row
                      label={t('gameRecordsBestLevel')}
                      value={String(row.bestLevel)}
                      styles={styles}
                      compact
                    />
                  </View>
                );
              })}
            </View>
            <Text style={styles.section}>{t('gameMahjongTitle')}</Text>
            <View style={styles.card}>
              <Row label={t('gameRecordsRuns')} value={String(mj.runsStarted)} styles={styles} />
              <Row label={t('gameRecordsClears')} value={String(mj.clears)} styles={styles} />
              <Row label={t('gameRecordsBestScore')} value={String(mj.bestScore)} styles={styles} />
              {(['easy', 'normal', 'hard'] as const).map((d) => {
                const row = mj.byDifficulty[d];
                const diffLabel =
                  d === 'easy'
                    ? t('gameMahjongDiffEasy')
                    : d === 'normal'
                      ? t('gameMahjongDiffNormal')
                      : t('gameMahjongDiffHard');
                const time =
                  row.bestTimeMs != null ? formatDurationMs(row.bestTimeMs) : t('gameRecordsEmpty');
                const score =
                  row.bestScore != null ? String(row.bestScore) : t('gameRecordsEmpty');
                return (
                  <View key={d} style={styles.diffBlock}>
                    <Text style={styles.diffTitle}>{diffLabel}</Text>
                    <Row
                      label={t('gameRecordsClears')}
                      value={String(row.clears)}
                      styles={styles}
                      compact
                    />
                    <Row label={t('gameRecordsBestTime')} value={time} styles={styles} compact />
                    <Row label={t('gameRecordsBestScore')} value={score} styles={styles} compact />
                  </View>
                );
              })}
            </View>
            <Text style={styles.footnote}>{t('gameRecordsFootnote')}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Row({
  label,
  value,
  styles,
  compact,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
  compact?: boolean;
}) {
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: BOTTOM_SHEET_BACKDROP_COLOR,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.bg,
      borderTopLeftRadius: UI_RADIUS_SHEET,
      borderTopRightRadius: UI_RADIUS_SHEET,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: theme.border,
      paddingHorizontal: 16,
      maxHeight: BOTTOM_SHEET_MAX_HEIGHT,
    },
    grab: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      marginTop: 16,
      marginBottom: 8,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 20,
      marginBottom: 10,
    },
    title: {
      flex: 1,
      fontSize: sf(18),
      fontWeight: '600',
      color: theme.text,
      lineHeight: sf(24),
    },
    closeBtn: {
      width: 44,
      height: 44,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
    },
    closeBtnPressed: {
      opacity: 0.85,
    },
    scroll: {
      ...BOTTOM_SHEET_SCROLL_STYLE,
    },
    scrollContent: {
      paddingBottom: 12,
      gap: 10,
    },
    section: {
      marginTop: 6,
      fontSize: sf(14),
      fontWeight: '700',
      color: theme.green,
    },
    card: {
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 2,
    },
    diffBlock: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      gap: 2,
    },
    diffTitle: {
      fontSize: sf(13),
      fontWeight: '700',
      color: theme.text,
      marginBottom: 2,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    rowCompact: {
      paddingVertical: 4,
    },
    rowLabel: {
      fontSize: sf(13),
      color: theme.textMuted,
      fontWeight: '600',
    },
    rowValue: {
      fontSize: sf(14),
      fontWeight: '700',
      color: theme.text,
    },
    footnote: {
      marginTop: 4,
      fontSize: sf(12),
      lineHeight: sf(17),
      color: theme.textDim,
    },
  });
}
