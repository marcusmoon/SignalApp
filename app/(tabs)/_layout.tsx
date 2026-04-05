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

const TAB_ICON_SIZE = 17;

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

/** 블러 글라스 + 라운드 클립 (슬랙식 플로팅 탭) */
function TabBarGlassBackground() {
  const r = TAB_BAR_FLOAT_RADIUS;

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: r,
            overflow: 'hidden',
            backgroundColor: 'rgba(10,10,15,0.9)',
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: 'rgba(255,255,255,0.1)',
          },
        ]}
      />
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius: r, overflow: 'hidden' }]}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 100 : 85}
        tint="dark"
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: r, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)' }]}
      />
    </View>
  );
}

export default function TabLayout() {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const tabBarBottom = TAB_BAR_FLOAT_MARGIN_BOTTOM + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.green,
        tabBarInactiveTintColor: 'rgba(224,224,240,0.36)',
        tabBarStyle: {
          position: 'absolute',
          left: TAB_BAR_FLOAT_MARGIN_H,
          right: TAB_BAR_FLOAT_MARGIN_H,
          bottom: tabBarBottom,
          height: TAB_BAR_FLOAT_HEIGHT,
          backgroundColor: 'transparent',
          borderRadius: TAB_BAR_FLOAT_RADIUS,
          borderTopWidth: 0,
          borderTopColor: 'transparent',
          overflow: 'hidden',
          paddingHorizontal: 4,
          paddingTop: 2,
          paddingBottom: 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.24,
          shadowRadius: 12,
          elevation: 8,
        },
        tabBarBackground: TabBarGlassBackground,
        tabBarLabelPosition: 'below-icon',
        tabBarAllowFontScaling: false,
        tabBarLabelStyle: {
          fontSize: 10,
          lineHeight: 12,
          fontWeight: '600',
          letterSpacing: 0.12,
          marginTop: 0,
          marginBottom: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
          paddingHorizontal: 0,
          justifyContent: 'center',
          alignItems: 'center',
          minWidth: 0,
          flex: 1,
        },
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 3,
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
