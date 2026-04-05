import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

import { TAB_BAR_FLOAT_RADIUS } from '@/constants/tabBar';
import { TAB_BAR_GLASS_PARAMS, type TabBarGlassLevel } from '@/constants/tabBarGlass';

type Props = {
  level: TabBarGlassLevel;
  style?: StyleProp<ViewStyle>;
};

/**
 * 하단 플로팅 탭바 글래스 재질. `app/(tabs)/_layout.tsx`와 설정 미리보기에서 공통 사용.
 * iOS: `borderRadius`+`overflow`는 BlurView 루트에만 두는 편이 블러가 ‘회색 판’으로 죽는 현상을 줄임.
 */
export function TabBarGlassSurface({ level, style }: Props) {
  const r = TAB_BAR_FLOAT_RADIUS;
  const p = TAB_BAR_GLASS_PARAMS[level];

  if (Platform.OS === 'web') {
    const webGlass = {
      borderRadius: r,
      overflow: 'hidden' as const,
      backgroundColor: `rgba(22,22,28,${p.web.bgAlpha})`,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `rgba(255,255,255,${p.web.borderAlpha})`,
      backdropFilter: `blur(${p.web.blurPx}px) saturate(${p.web.saturate}%)`,
      WebkitBackdropFilter: `blur(${p.web.blurPx}px) saturate(${p.web.saturate}%)`,
    };
    return <View style={[style, webGlass as object]} />;
  }

  const iosBlurTint = 'systemUltraThinMaterialDark' as const;

  if (Platform.OS === 'ios') {
    return (
      <View style={[style, { borderRadius: r, overflow: 'hidden' }]} pointerEvents="none">
        <BlurView
          intensity={p.ios.intensity}
          tint={iosBlurTint}
          style={[StyleSheet.absoluteFill, { borderRadius: r, overflow: 'hidden' }]}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 12,
            right: 12,
            height: StyleSheet.hairlineWidth,
            backgroundColor: `rgba(255,255,255,${p.ios.highlightAlpha})`,
          }}
        />
      </View>
    );
  }

  const a = p.android;
  return (
    <View
      style={[style, { borderRadius: r, overflow: 'hidden' }]}
      pointerEvents="none">
      <BlurView
        intensity={a.blur}
        tint="dark"
        blurReductionFactor={2}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: `rgba(18,18,24,${a.dimAlpha})`,
            borderRadius: r,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: StyleSheet.hairlineWidth * 2,
          backgroundColor: `rgba(255,255,255,${a.topAlpha})`,
        }}
      />
    </View>
  );
}
