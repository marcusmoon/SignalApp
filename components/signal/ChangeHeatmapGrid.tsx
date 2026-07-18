import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { formatHeatChangePct, heatFillColor } from '@/domain/heatmaps/changeHeat';
import {
  getQuoteChangeColors,
  isQuoteChangePositive,
  type QuotesChangeColorConvention,
} from '@/domain/quotes/changeColorConvention';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

export type ChangeHeatmapCell = {
  key: string;
  /** 셀 상단 강조 (티커 또는 섹터명) */
  title: string;
  /** 보조 라벨 */
  subtitle?: string | null;
  /** 채색·표시에 쓰는 등락률 */
  changePercent: number | null;
  /** 표시 등락이 추정일 때 true → `—` 대신 trend soft 숫자를 숨기고 title만 */
  displayPercent?: number | null;
  onPress?: () => void;
  accessibilityLabel?: string;
};

type Props = {
  cells: ChangeHeatmapCell[];
  theme: AppTheme;
  scaleFont: (n: number) => number;
  changeColorConvention: QuotesChangeColorConvention;
};

/** 시장 브리핑 섹터 · ETF 히트맵 공통 3열 그리드 */
export function ChangeHeatmapGrid({
  cells,
  theme,
  scaleFont,
  changeColorConvention,
}: Props) {
  const { effectiveColorScheme, feedTypo } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const changeColors = getQuoteChangeColors(changeColorConvention, effectiveColorScheme);

  if (cells.length === 0) return null;

  return (
    <View style={styles.heatGrid}>
      {cells.map((cell) => {
        const heatPct = cell.changePercent;
        const shownPct = cell.displayPercent !== undefined ? cell.displayPercent : heatPct;
        const positive = heatPct == null ? null : isQuoteChangePositive({ changePercent: heatPct });
        const pctColor =
          positive === null ? theme.textMuted : positive ? changeColors.up : changeColors.down;
        const fill = heatFillColor(heatPct, changeColors.up, changeColors.down, theme.bgElevated);
        const pressable = Boolean(cell.onPress);
        return (
          <Pressable
            key={cell.key}
            onPress={cell.onPress}
            disabled={!pressable}
            style={({ pressed }) => [
              styles.heatCell,
              { backgroundColor: fill },
              pressed && pressable ? styles.heatCellPressed : null,
            ]}
            accessibilityRole={pressable ? 'link' : 'text'}
            accessibilityLabel={
              cell.accessibilityLabel ||
              `${cell.title}${cell.subtitle ? ` ${cell.subtitle}` : ''} ${formatHeatChangePct(shownPct)}`
            }>
            <Text style={styles.heatCellTitle} numberOfLines={1}>
              {cell.title}
            </Text>
            {cell.subtitle ? (
              <Text style={styles.heatCellSubtitle} numberOfLines={1}>
                {cell.subtitle}
              </Text>
            ) : null}
            <Text style={[styles.heatCellPct, { color: pctColor }]}>
              {formatHeatChangePct(shownPct)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    heatGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    heatCell: {
      width: '31.8%',
      flexGrow: 1,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      paddingHorizontal: 8,
      paddingVertical: 10,
      gap: 2,
      minHeight: 74,
      justifyContent: 'center',
    },
    heatCellPressed: {
      opacity: 0.78,
    },
    heatCellTitle: {
      fontSize: ft.ff(13),
      lineHeight: sf(17),
      fontWeight: ft.titleWeight,
      color: theme.text,
      fontVariant: ['tabular-nums'],
    },
    heatCellSubtitle: {
      fontSize: ft.ff(11),
      lineHeight: sf(14),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
    },
    heatCellPct: {
      marginTop: 2,
      fontSize: ft.ff(13),
      lineHeight: sf(17),
      fontWeight: ft.emphasisWeight,
      fontVariant: ['tabular-nums'],
    },
  });
}
