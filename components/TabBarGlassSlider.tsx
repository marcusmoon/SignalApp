import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { clampTabBarGlassLevel, type TabBarGlassLevel } from '@/constants/tabBarGlass';

const THUMB_W = 26;
const TRACK_H = 8;

type Props = {
  level: TabBarGlassLevel;
  accentColor: string;
  accessibilityLabel: string;
  onPreviewChange: (percent: number) => void;
  onCommit: (level: TabBarGlassLevel) => void;
};

function percentFromLevel(lv: TabBarGlassLevel): number {
  return Math.round((lv / 4) * 100);
}

export function TabBarGlassSlider({
  level,
  accentColor,
  accessibilityLabel,
  onPreviewChange,
  onCommit,
}: Props) {
  const [percent, setPercent] = useState(() => percentFromLevel(level));
  const [trackW, setTrackW] = useState(0);
  const trackWRef = useRef(0);

  useEffect(() => {
    setPercent(percentFromLevel(level));
  }, [level]);

  const applyX = useCallback(
    (x: number) => {
      const w = trackWRef.current;
      if (w <= 0) return;
      const ratio = Math.max(0, Math.min(1, x / w));
      const p = Math.round(ratio * 100);
      setPercent(p);
      onPreviewChange(p);
    },
    [onPreviewChange],
  );

  const finalizeX = useCallback(
    (x: number) => {
      const w = trackWRef.current;
      if (w <= 0) return;
      const ratio = Math.max(0, Math.min(1, x / w));
      const lv = clampTabBarGlassLevel(Math.round(ratio * 4));
      const p = percentFromLevel(lv);
      setPercent(p);
      onPreviewChange(p);
      onCommit(lv);
    },
    [onCommit, onPreviewChange],
  );

  const onLayoutTrack = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) {
      trackWRef.current = w;
      setTrackW(w);
    }
  }, []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-14, 14])
        .onBegin((e) => {
          runOnJS(applyX)(e.x);
        })
        .onUpdate((e) => {
          runOnJS(applyX)(e.x);
        })
        .onEnd((e) => {
          runOnJS(finalizeX)(e.x);
        }),
    [applyX, finalizeX],
  );

  const thumbLeftPx = trackW > 0 ? (percent / 100) * (trackW - THUMB_W) : 0;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}>
      <GestureDetector gesture={pan}>
        <View style={styles.trackWrap} onLayout={onLayoutTrack}>
          <View style={[styles.track, { height: TRACK_H }]} />
          <View
            style={[
              styles.thumb,
              {
                width: THUMB_W,
                left: thumbLeftPx,
                borderColor: accentColor,
                shadowColor: accentColor,
                ...Platform.select({
                  ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 4 },
                  android: { elevation: 4 },
                  default: {},
                }),
              },
            ]}
            pointerEvents="none"
          />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    paddingVertical: 4,
    justifyContent: 'center',
  },
  trackWrap: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    height: 40,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: 'rgba(18,18,24,0.95)',
  },
});
