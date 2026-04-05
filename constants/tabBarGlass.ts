/** 하단 플로팅 탭바 글래스 단계 (0=가장 투명, 4=가장 진함). `app/(tabs)/_layout.tsx`와 동기화 */
export type TabBarGlassLevel = 0 | 1 | 2 | 3 | 4;

/** UI 퍼센트 기준 기본값(약 50% = 단계 2/4) */
export const DEFAULT_TAB_BAR_GLASS_PERCENT = 50;

export const DEFAULT_TAB_BAR_GLASS_LEVEL: TabBarGlassLevel = 2;

export const TAB_BAR_GLASS_MIN = 0;
export const TAB_BAR_GLASS_MAX = 4;

export function clampTabBarGlassLevel(n: number): TabBarGlassLevel {
  const r = Math.round(n);
  if (r <= TAB_BAR_GLASS_MIN) return TAB_BAR_GLASS_MIN;
  if (r >= TAB_BAR_GLASS_MAX) return TAB_BAR_GLASS_MAX;
  return r as TabBarGlassLevel;
}

export type TabBarGlassVisualParams = {
  web: {
    bgAlpha: number;
    borderAlpha: number;
    blurPx: number;
    saturate: number;
  };
  ios: {
    intensity: number;
    highlightAlpha: number;
  };
  android: {
    blur: number;
    dimAlpha: number;
    topAlpha: number;
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
};

/** 단계별 시각 파라미터 (웹 / iOS / 안드로이드) */
export const TAB_BAR_GLASS_PARAMS: Record<TabBarGlassLevel, TabBarGlassVisualParams> = {
  0: {
    web: { bgAlpha: 0.08, borderAlpha: 0.05, blurPx: 16, saturate: 135 },
    ios: { intensity: 28, highlightAlpha: 0.045 },
    android: {
      blur: 24,
      dimAlpha: 0.02,
      topAlpha: 0.055,
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 8,
    },
  },
  1: {
    web: { bgAlpha: 0.1, borderAlpha: 0.065, blurPx: 18, saturate: 142 },
    ios: { intensity: 35, highlightAlpha: 0.055 },
    android: {
      blur: 29,
      dimAlpha: 0.025,
      topAlpha: 0.065,
      shadowOpacity: 0.125,
      shadowRadius: 11,
      elevation: 10,
    },
  },
  2: {
    web: { bgAlpha: 0.13, borderAlpha: 0.08, blurPx: 20, saturate: 150 },
    ios: { intensity: 42, highlightAlpha: 0.065 },
    android: {
      blur: 34,
      dimAlpha: 0.03,
      topAlpha: 0.075,
      shadowOpacity: 0.15,
      shadowRadius: 13,
      elevation: 12,
    },
  },
  3: {
    web: { bgAlpha: 0.17, borderAlpha: 0.1, blurPx: 23, saturate: 158 },
    ios: { intensity: 52, highlightAlpha: 0.085 },
    android: {
      blur: 41,
      dimAlpha: 0.045,
      topAlpha: 0.092,
      shadowOpacity: 0.185,
      shadowRadius: 14,
      elevation: 14,
    },
  },
  4: {
    web: { bgAlpha: 0.24, borderAlpha: 0.12, blurPx: 26, saturate: 168 },
    ios: { intensity: 62, highlightAlpha: 0.105 },
    android: {
      blur: 50,
      dimAlpha: 0.06,
      topAlpha: 0.11,
      shadowOpacity: 0.22,
      shadowRadius: 16,
      elevation: 16,
    },
  },
};
