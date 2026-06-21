/**
 * iPad 2-패널 레이아웃 (마스터·디테일).
 * - useTwoPane=true : 좌측 마스터 리스트 + 우측 디테일 패널
 * - useTwoPane=false : 기존 단일 컬럼 (모바일)
 *
 * 사용 예시:
 *   <MasterDetailLayout
 *     useTwoPane={useTwoPane}
 *     masterWidthRatio={0.36}
 *     masterPanel={<QuotesList ... />}
 *     detailPanel={selectedSymbol ? <SymbolDetailPane symbol={selectedSymbol} /> : <EmptyDetail />}
 *   />
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import {
  MASTER_PANEL_MIN_WIDTH,
  MASTER_PANEL_WIDTH_RATIO,
} from '@/constants/responsiveLayout';

type Props = {
  /** iPad wide 모드 여부 */
  useTwoPane: boolean;
  /** 마스터(좌측) 패널 너비 비율 (0~1). 기본값 MASTER_PANEL_WIDTH_RATIO */
  masterWidthRatio?: number;
  /** 마스터(좌측) 패널 최소 폭 px. 기본값 MASTER_PANEL_MIN_WIDTH */
  masterMinWidth?: number;
  /** 좌측에 표시할 리스트 컴포넌트 */
  masterPanel: React.ReactNode;
  /** 우측에 표시할 디테일 컴포넌트 */
  detailPanel?: React.ReactNode;
  /** 마스터/디테일 구분선 색상 */
  dividerColor?: string;
  /** 최상위 View에 추가할 style */
  style?: object;
};

export function MasterDetailLayout({
  useTwoPane,
  masterWidthRatio = MASTER_PANEL_WIDTH_RATIO,
  masterMinWidth = MASTER_PANEL_MIN_WIDTH,
  masterPanel,
  detailPanel,
  dividerColor = '#2A2E3A',
  style,
}: Props) {
  if (!useTwoPane) {
    return <View style={[styles.single, style]}>{masterPanel}</View>;
  }

  return (
    <View style={[styles.container, style]}>
      {/* 마스터 패널: flex 비율로 최소 폭 보장 */}
      <View
        style={[
          styles.masterPanel,
          {
            flexBasis: `${Math.round(masterWidthRatio * 100)}%`,
            minWidth: masterMinWidth,
            borderRightColor: dividerColor,
          },
        ]}>
        {masterPanel}
      </View>

      {/* 디테일 패널 */}
      <View style={styles.detailPanel}>{detailPanel ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  single: {
    flex: 1,
  },
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  masterPanel: {
    flexShrink: 0,
    flexGrow: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  detailPanel: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
});
