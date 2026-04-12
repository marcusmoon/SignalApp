import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

export function SignalHeader() {
  const router = useRouter();
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <View style={styles.logoRow}>
          <View style={styles.bars}>
            <View style={[styles.bar, { height: 16, opacity: 0.35 }]} />
            <View style={[styles.bar, { height: 26, opacity: 0.6 }]} />
            <View style={[styles.bar, { height: 36, opacity: 0.82 }]} />
            <View style={[styles.bar, { height: 46, opacity: 1 }]} />
          </View>
          <View style={styles.brandCol}>
            <Text style={styles.brand}>SIGNAL</Text>
            <Text style={styles.tag} numberOfLines={2}>
              {t('headerTagline')}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push('/alerts')}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t('a11yAlerts')}>
            <FontAwesome name="bell" size={21} color={theme.textDim} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/calendar')}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t('a11yCalendar')}>
            <FontAwesome name="calendar" size={21} color={theme.textDim} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/settings')}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t('a11ySettings')}>
            <FontAwesome name="cog" size={21} color={theme.textDim} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    wrap: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.bg,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
      marginRight: -2,
    },
    iconBtn: {
      paddingVertical: 10,
      paddingHorizontal: 10,
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
    },
    brandCol: {
      flex: 1,
      minWidth: 0,
    },
    bars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
      height: 46,
      flexShrink: 0,
    },
    bar: {
      width: 9,
      backgroundColor: theme.green,
      borderRadius: 3,
    },
    brand: {
      fontSize: sf(18),
      fontWeight: '900',
      color: theme.green,
      letterSpacing: -0.4,
    },
    tag: {
      marginTop: 1,
      fontSize: sf(11),
      lineHeight: sf(14),
      fontWeight: '600',
      color: theme.textDim,
    },
  });
}
