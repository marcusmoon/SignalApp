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

/** 설정 화면용: 실제 하단 탭바와 동일한 높이의 글래스 막대만 보여준다. */
export function TabBarGlassPreview({ percent }: Props) {
  const level = levelFromPercent(percent);

  return (
    <View style={styles.shell}>
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
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabDock: {
    position: 'relative',
    width: '100%',
    maxWidth: 400,
    height: TAB_BAR_FLOAT_HEIGHT,
  },
  iconRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
  },
});
