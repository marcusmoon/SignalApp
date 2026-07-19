import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  HOME_SHORTCUT_CATALOG,
  type HomeShortcutKey,
} from '@/constants/homeShortcuts';
import type { AppTheme } from '@/constants/theme';
import { UI_RADIUS_CARD } from '@/constants/uiCornerRadius';
import { useIpadSidebarNavActions } from '@/contexts/IpadSidebarNavContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

const GRID_GAP = 8;
const TILE_MIN_HEIGHT = 58;

type Props = {
  keys: HomeShortcutKey[];
  selectedYmd: string;
};

function resolveColumns(count: number, useTwoPane: boolean, containerWidth: number): number {
  if (count <= 1) return 1;
  if (useTwoPane || containerWidth >= 420) return Math.min(4, count);
  if (containerWidth >= 300) return Math.min(4, count);
  return Math.min(2, count);
}

export function HomeShortcutsStrip({ keys, selectedYmd }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const router = useRouter();
  const ipadNav = useIpadSidebarNavActions();
  const { useTwoPane } = useResponsiveLayout();
  const [containerWidth, setContainerWidth] = useState(0);
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const items = useMemo(
    () => HOME_SHORTCUT_CATALOG.filter((row) => keys.includes(row.key)),
    [keys],
  );

  const columns = useMemo(
    () => resolveColumns(items.length, useTwoPane, containerWidth),
    [containerWidth, items.length, useTwoPane],
  );

  const tileWidth = useMemo(() => {
    if (containerWidth <= 0 || columns <= 0) return undefined;
    return (containerWidth - GRID_GAP * (columns - 1)) / columns;
  }, [columns, containerWidth]);

  const openShortcut = useCallback(
    (key: HomeShortcutKey) => {
      switch (key) {
        case 'board':
          if (ipadNav.isAvailable) {
            ipadNav.showBoard({ drillFrom: 'home' });
            return;
          }
          router.navigate('/(tabs)/board' as never);
          return;
        case 'quotes':
          if (ipadNav.isAvailable) ipadNav.showTabs();
          router.navigate('/(tabs)/quotes' as never);
          return;
        case 'news':
          ipadNav.showNewsTab('global');
          return;
        case 'newsIt':
          ipadNav.showNewsTab('it');
          return;
        case 'calendar':
          if (ipadNav.isAvailable) {
            ipadNav.showCalendar({ drillFrom: 'home' });
            return;
          }
          router.navigate('/calendar' as never);
          return;
        case 'etf':
          if (ipadNav.isAvailable) {
            ipadNav.showEtfInsights({ drillFrom: 'home' });
            return;
          }
          router.navigate('/etf-insights' as never);
          return;
        case 'disclosures':
          if (ipadNav.isAvailable) {
            ipadNav.showDisclosureFlow({ date: selectedYmd }, { drillFrom: 'home' });
            return;
          }
          router.navigate({
            pathname: '/disclosure-flow',
            params: { date: selectedYmd },
          } as never);
          return;
        case 'settings':
          if (ipadNav.isAvailable) {
            ipadNav.showSettings('display', { drillFrom: 'home' });
            return;
          }
          router.navigate({ pathname: '/settings', params: { tab: 'display' } } as never);
          return;
        default:
          return;
      }
    },
    [ipadNav, router, selectedYmd],
  );

  if (items.length === 0) return null;

  return (
    <View
      style={styles.grid}
      onLayout={(event) => {
        const next = Math.max(0, event.nativeEvent.layout.width);
        setContainerWidth((prev) => (prev === next ? prev : next));
      }}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={() => openShortcut(item.key)}
          accessibilityRole="button"
          accessibilityLabel={t(item.titleId)}
          style={({ pressed }) => [
            styles.tile,
            tileWidth != null ? { width: tileWidth } : styles.tileFallback,
            pressed && styles.tilePressed,
          ]}>
          <FontAwesome name={item.icon} size={scaleFont(17)} color={theme.green} />
          <Text style={styles.label} numberOfLines={1}>
            {t(item.titleId)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GRID_GAP,
    },
    tile: {
      minHeight: TILE_MIN_HEIGHT,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      paddingVertical: 10,
      gap: 6,
    },
    tileFallback: {
      flexGrow: 1,
      minWidth: '46%',
    },
    tilePressed: {
      backgroundColor: theme.greenDim,
    },
    label: {
      fontSize: sf(11),
      lineHeight: sf(14),
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
    },
  });
}
