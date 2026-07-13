import { StyleSheet, type ViewStyle } from 'react-native';

import { COMFORT_MARGIN_GROUP } from '@/constants/comfortDensity';
import type { AppTheme } from '@/constants/theme';

import { UI_RADIUS_GROUPED_FEED } from '@/constants/uiCornerRadius';

/** 홈 `evidenceList` · `signalList`와 동일한 플로팅 카드 둥근 모서리 */
export const GROUPED_FEED_RADIUS = UI_RADIUS_GROUPED_FEED;

export type GroupedFeedRowEdges = {
  isFirst: boolean;
  isLast: boolean;
};

/** 행 사이 구분 — `theme.border`보다 살짝 진하게(헤어라인은 밝은 테마에서 잘 안 보임) */
export function groupedFeedSeparatorColor(theme: AppTheme): string {
  return theme.colorScheme === 'dark' ? '#3E3E4E' : '#D1D6DB';
}

/** 홈·카드 내부 리스트 행 구분선 (다이제스트·공시·캘린더 등) */
export function cardListRowSeparatorStyle(theme: AppTheme): Pick<ViewStyle, 'borderBottomWidth' | 'borderBottomColor'> {
  return {
    borderBottomWidth: 1,
    borderBottomColor: groupedFeedSeparatorColor(theme),
  };
}

/** FlatList 행 — 광고 등으로 끊긴 구간마다 상·하단 라운드 재적용 */
export function groupedFeedRowEdges(
  rows: readonly { kind: string }[],
  index: number,
  contentKind: string,
): GroupedFeedRowEdges | null {
  const row = rows[index];
  if (!row || row.kind !== contentKind) return null;
  const prev = rows[index - 1];
  const next = rows[index + 1];
  return {
    isFirst: !prev || prev.kind !== contentKind,
    isLast: !next || next.kind !== contentKind,
  };
}

export function groupedFeedRowShell(
  theme: AppTheme,
  { isFirst, isLast }: GroupedFeedRowEdges,
): ViewStyle {
  const separator = groupedFeedSeparatorColor(theme);
  return {
    backgroundColor: theme.card,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    ...(isFirst
      ? {
          borderTopWidth: 1,
          borderTopLeftRadius: GROUPED_FEED_RADIUS,
          borderTopRightRadius: GROUPED_FEED_RADIUS,
        }
      : {
          borderTopWidth: 0,
        }),
    ...(isLast
      ? {
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          borderBottomLeftRadius: GROUPED_FEED_RADIUS,
          borderBottomRightRadius: GROUPED_FEED_RADIUS,
          marginBottom: COMFORT_MARGIN_GROUP,
        }
      : {
          borderBottomWidth: 1,
          borderBottomColor: separator,
          marginBottom: 0,
        }),
  };
}
