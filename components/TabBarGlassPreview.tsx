import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { TAB_BAR_FLOAT_HEIGHT, TAB_BAR_FLOAT_RADIUS } from '@/constants/tabBar';
import { clampTabBarGlassLevel, type TabBarGlassLevel } from '@/constants/tabBarGlass';
import { TabBarGlassSurface } from '@/components/TabBarGlassSurface';

const PREVIEW_ICONS: Array<ComponentProps<typeof FontAwesome>['name']> = [
  'newspaper-o',
  'youtube-play',
  'line-chart',
  'microphone',
];

type Props = {
  /** 0–100 (드래그 중 미리보기용) */
  percent: number;
};

function levelFromPercent(percent: number): TabBarGlassLevel {
  return clampTabBarGlassLevel(Math.round((percent / 100) * 4));
}

export function TabBarGlassPreview({ percent }: Props) {
  const level = levelFromPercent(percent);

  return (
    <View style={styles.shell}>
      <View style={styles.mockScreen}>
        <View style={styles.mockBlock} />
        <View style={styles.mockBlockAlt} />
        <View style={styles.mockRow}>
          <View style={styles.mockChip} />
          <View style={[styles.mockChip, { backgroundColor: 'rgba(120,200,255,0.35)' }]} />
          <View style={[styles.mockChip, { backgroundColor: 'rgba(255,200,120,0.4)' }]} />
        </View>
      </View>
      <View style={styles.tabDock}>
        <TabBarGlassSurface
          level={level}
          style={{
            width: '100%',
            height: TAB_BAR_FLOAT_HEIGHT,
            borderRadius: TAB_BAR_FLOAT_RADIUS,
            overflow: 'hidden',
          }}
        />
        <View style={styles.iconRow} pointerEvents="none">
          {PREVIEW_ICONS.map((name) => (
            <FontAwesome key={name} name={name} size={17} color="rgba(255,255,255,0.88)" />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#14141C',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mockScreen: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 8,
  },
  mockBlock: {
    height: 10,
    width: '72%',
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  mockBlockAlt: {
    height: 10,
    width: '48%',
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  mockRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  mockChip: {
    flex: 1,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(90,200,140,0.25)',
  },
  tabDock: {
    position: 'relative',
    height: TAB_BAR_FLOAT_HEIGHT,
    marginHorizontal: 10,
    marginBottom: 10,
  },
  iconRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
  },
});
