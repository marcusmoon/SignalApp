import { Platform, StyleSheet, View } from 'react-native';

export function colorWithAlpha(color: string, alpha: number): string {
  const normalized = color.trim();
  const clamped = Math.max(0, Math.min(1, alpha));
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    const r = Number.parseInt(normalized.slice(1, 3), 16);
    const g = Number.parseInt(normalized.slice(3, 5), 16);
    const b = Number.parseInt(normalized.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${clamped})`;
  }
  return normalized;
}

/** 플로팅 탭바 — 글라스/반투명 표면의 가장자리 구분 */
export function glassEdgeColors(scheme: 'light' | 'dark', border: string) {
  const isDark = scheme === 'dark';
  return {
    ring: isDark ? colorWithAlpha('#FFFFFF', 0.24) : colorWithAlpha(border, 0.95),
    topHighlight: isDark ? colorWithAlpha('#FFFFFF', 0.1) : colorWithAlpha('#FFFFFF', 0.78),
  };
}

export type GlassEdgeColors = ReturnType<typeof glassEdgeColors>;

/** 탭바·FAB 공통 외곽선 두께 */
export function glassSurfaceBorderWidth(): number {
  return Platform.OS === 'web' ? StyleSheet.hairlineWidth : 1;
}

type GlassSurfaceBackgroundProps = {
  backgroundColor: string;
  borderRadius: number;
  edge: GlassEdgeColors;
  /** 캡슐형 탭바 상단 하이라이트. 원형 FAB는 false */
  showTopHighlight?: boolean;
  borderWidth?: number;
};

export function GlassSurfaceBackground({
  backgroundColor,
  borderRadius,
  edge,
  showTopHighlight = false,
  borderWidth,
}: GlassSurfaceBackgroundProps) {
  const resolvedBorderWidth = borderWidth ?? glassSurfaceBorderWidth();

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor, borderRadius }]} />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius,
            borderWidth: resolvedBorderWidth,
            borderColor: edge.ring,
          },
        ]}
      />
      {showTopHighlight ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: StyleSheet.hairlineWidth,
            left: 14,
            right: 14,
            height: StyleSheet.hairlineWidth,
            backgroundColor: edge.topHighlight,
            opacity: 0.9,
          }}
        />
      ) : null}
    </View>
  );
}

export function floatingGlassShadow(scheme: 'light' | 'dark') {
  return Platform.OS === 'ios'
    ? {
        shadowColor: '#000000',
        shadowOpacity: scheme === 'dark' ? 0.35 : 0.12,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
      }
    : {
        shadowColor: '#191F28',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
        elevation: 10,
      };
}

export function floatingFabShadow(scheme: 'light' | 'dark') {
  return Platform.OS === 'ios'
    ? {
        shadowColor: '#000000',
        shadowOpacity: scheme === 'dark' ? 0.42 : 0.18,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: 8 },
      }
    : {
        shadowColor: '#191F28',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 18,
        elevation: 12,
      };
}
