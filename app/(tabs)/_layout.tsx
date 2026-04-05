import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TAB_BAR_FLOAT_HEIGHT,
  TAB_BAR_FLOAT_MARGIN_BOTTOM,
  TAB_BAR_FLOAT_MARGIN_H,
  TAB_BAR_FLOAT_RADIUS,
} from '@/constants/tabBar';
import { SlackTabBarButton } from '@/components/SlackTabBarButton';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

const TAB_ICON_SIZE = 22;

function TabBarIcon({
  name,
  color,
}: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
  focused?: boolean;
}) {
  return (
    <View style={tabIconWrap}>
      <FontAwesome name={name} size={TAB_ICON_SIZE} color={color} />
    </View>
  );
}

const tabIconWrap = {
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  height: TAB_ICON_SIZE + 2,
};

/** 애플 뮤직/시스템 탭바에 가까운 재질: 블러 + 어두운 틴트 + 상단 헤어라인(플로팅 캡슐) */
function TabBarGlassBackground() {
  const r = TAB_BAR_FLOAT_RADIUS;

  if (Platform.OS === 'web') {
    /** RN Web: 불투명만 쓰면 뒤 콘텐츠가 안 비쳐 ‘유리’가 아님 — blur + 낮은 알파 */
    const webGlass = {
      borderRadius: r,
      overflow: 'hidden' as const,
      backgroundColor: 'rgba(22,22,28,0.42)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.14)',
      backdropFilter: 'blur(28px) saturate(180%)',
      WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    };
    return (
      <View style={[StyleSheet.absoluteFill, webGlass as object]} />
    );
  }

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: r,
          overflow: 'hidden',
        },
      ]}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 95 : 80}
        tint="dark"
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: 'rgba(18,18,24,0.28)',
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
          backgroundColor: 'rgba(255,255,255,0.14)',
        }}
      />
    </View>
  );
}

export default function TabLayout() {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const tabBarInnerPadBottom = 6;
  const tabBarInnerPadTop = 6;
  const tabBarContentHeight = TAB_BAR_FLOAT_HEIGHT;
  /** 플로팅 바: 홈 인디케이터 위에 뜨므로 높이에 insets.bottom 미포함 */
  const tabBarTotalHeight = tabBarContentHeight + tabBarInnerPadTop + tabBarInnerPadBottom;
  const tabBarBottom = insets.bottom + TAB_BAR_FLOAT_MARGIN_BOTTOM;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.green,
        tabBarInactiveTintColor: 'rgba(142,142,147,0.88)',
        tabBarStyle: {
          position: 'absolute',
          left: TAB_BAR_FLOAT_MARGIN_H,
          right: TAB_BAR_FLOAT_MARGIN_H,
          bottom: tabBarBottom,
          height: tabBarTotalHeight,
          paddingBottom: tabBarInnerPadBottom,
          paddingTop: tabBarInnerPadTop,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          borderTopColor: 'transparent',
          borderRadius: TAB_BAR_FLOAT_RADIUS,
          overflow: 'hidden',
          paddingHorizontal: 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.22,
          shadowRadius: 16,
          elevation: 18,
        },
        tabBarBackground: TabBarGlassBackground,
        tabBarLabelPosition: 'below-icon',
        tabBarAllowFontScaling: false,
        tabBarLabelStyle: {
          fontSize: 10,
          lineHeight: 12,
          fontWeight: '600',
          letterSpacing: -0.08,
          marginTop: 2,
          marginBottom: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
          paddingHorizontal: 0,
          justifyContent: 'center',
          alignItems: 'center',
          minWidth: 0,
          flex: 1,
        },
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 1,
        },
        tabBarButton: (props) => <SlackTabBarButton {...props} />,
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabNews'),
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="newspaper-o" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="youtube"
        options={{
          title: t('tabYoutube'),
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="youtube-play" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="quotes"
        options={{
          title: t('tabQuotes'),
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="line-chart" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          title: t('tabCalls'),
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="microphone" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
