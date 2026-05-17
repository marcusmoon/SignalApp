import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TextStyle } from 'react-native';

const STORAGE_KEY = '@signal/feed_content_weight_v1';

export type FeedContentWeightId = 'regular' | 'bold';

const VALID = new Set<string>(['regular', 'bold']);

export type FeedContentTypography = {
  weight: FeedContentWeightId;
  titleWeight: TextStyle['fontWeight'];
  emphasisWeight: TextStyle['fontWeight'];
  bodyWeight: TextStyle['fontWeight'];
  metaWeight: TextStyle['fontWeight'];
  /** 홈 「주요 시그널」행 — 보통/볼드 차이를 크게 */
  signalTitleWeight: TextStyle['fontWeight'];
  signalBodyWeight: TextStyle['fontWeight'];
  signalMetaWeight: TextStyle['fontWeight'];
  pad: (n: number) => number;
  row: (n: number) => number;
  signalRow: (n: number) => number;
  /** 피드 제목·심볼 등 핵심 텍스트 크기 — `scaleFont` 위에 볼드 시 +1px */
  ff: (px: number) => number;
  signalTitleFont: (px: number) => number;
  signalBodyFont: (px: number) => number;
};

export function feedContentTypography(
  weight: FeedContentWeightId,
  scaleFont: (px: number) => number,
): FeedContentTypography {
  const bold = weight === 'bold';
  return {
    weight,
    titleWeight: bold ? '900' : '700',
    emphasisWeight: bold ? '800' : '600',
    bodyWeight: bold ? '700' : '500',
    metaWeight: bold ? '600' : '500',
    signalTitleWeight: bold ? '900' : '600',
    signalBodyWeight: bold ? '800' : '500',
    signalMetaWeight: bold ? '800' : '500',
    pad: (n) => (bold ? Math.round(n * 1.2) : n),
    row: (n) => (bold ? Math.round(n * 1.14) : n),
    signalRow: (n) => (bold ? Math.round(n * 1.18) : n),
    ff: (px) => scaleFont(bold ? px + 1 : px),
    signalTitleFont: (px) => scaleFont(bold ? px + 2 : px),
    signalBodyFont: (px) => scaleFont(bold ? px + 1 : px),
  };
}

export async function loadFeedContentWeight(): Promise<FeedContentWeightId> {
  const v = await AsyncStorage.getItem(STORAGE_KEY);
  if (v && VALID.has(v)) return v as FeedContentWeightId;
  return 'bold';
}

export async function saveFeedContentWeight(id: FeedContentWeightId): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, VALID.has(id) ? id : 'bold');
}
