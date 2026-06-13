import { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';

type MiniSparkPoint = {
  x: number;
  y: number;
};

function sparkPoints(values: number[], width: number, height: number): MiniSparkPoint[] {
  if (values.length < 2 || width <= 0 || height <= 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1e-6);
  const stepX = width / (values.length - 1);
  return values.map((value, index) => ({
    x: stepX * index,
    y: height - ((value - min) / spread) * height,
  }));
}

function sampleSparklineValues(values: number[], maxPoints = 14): number[] {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length <= maxPoints) return finiteValues;
  const lastIndex = finiteValues.length - 1;
  return Array.from({ length: maxPoints }, (_, index) => {
    const sourceIndex = Math.round((index / (maxPoints - 1)) * lastIndex);
    return finiteValues[sourceIndex];
  });
}

export function MiniSparkline({
  values,
  color,
  mutedColor,
}: {
  values: number[];
  color: string;
  mutedColor: string;
}) {
  const [width, setWidth] = useState(0);
  const height = 28;
  const sampledValues = useMemo(() => sampleSparklineValues(values), [values]);
  const points = useMemo(() => sparkPoints(sampledValues, width, height - 4), [sampledValues, width]);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.max(0, event.nativeEvent.layout.width - 2);
    setWidth((prev) => (Math.abs(prev - nextWidth) < 1 ? prev : nextWidth));
  }, []);

  return (
    <View onLayout={onLayout} style={styles.wrap}>
      <View style={[styles.baseline, { backgroundColor: mutedColor }]} />
      {points.slice(0, -1).map((point, index) => {
        const next = points[index + 1];
        const dx = next.x - point.x;
        const dy = next.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <View
            key={`seg-${index}`}
            style={[
              styles.seg,
              {
                left: point.x,
                top: point.y + 2,
                width: Math.max(length, 1),
                backgroundColor: color,
                transform: [{ rotate: `${angle}deg` }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 96,
    height: 28,
    marginTop: 7,
    position: 'relative',
    overflow: 'hidden',
  },
  baseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: StyleSheet.hairlineWidth,
    opacity: 0.8,
  },
  seg: {
    position: 'absolute',
    height: 2,
    borderRadius: 999,
    transformOrigin: 'left center',
  },
});
