import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

export function SignalHeader() {
  const router = useRouter();
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <View style={styles.logoRow}>
          <View style={styles.bars}>
            <View style={[styles.bar, { height: 14, opacity: 0.35 }]} />
            <View style={[styles.bar, { height: 24, opacity: 0.6 }]} />
            <View style={[styles.bar, { height: 34, opacity: 0.82 }]} />
            <View style={[styles.bar, { height: 42, opacity: 1 }]} />
          </View>
          <View>
            <Text style={styles.brand}>SIGNAL</Text>
            <Text style={styles.tag}>{t('headerTagline')}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push('/alerts')}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t('a11yAlerts')}>
            <FontAwesome name="bell" size={18} color={theme.textDim} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/calendar')}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t('a11yCalendar')}>
            <FontAwesome name="calendar" size={17} color={theme.textDim} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/settings')}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t('a11ySettings')}>
            <FontAwesome name="cog" size={18} color={theme.textDim} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrap: {
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 8,
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
      gap: 0,
      marginRight: -2,
    },
    iconBtn: {
      padding: 6,
    },
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    bars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
      height: 42,
    },
    bar: {
      width: 9,
      backgroundColor: theme.green,
      borderRadius: 3,
    },
    brand: {
      fontSize: 17,
      fontWeight: '900',
      color: theme.green,
      letterSpacing: -0.4,
    },
    tag: {
      marginTop: 1,
      fontSize: 10,
      lineHeight: 13,
      color: theme.textDim,
    },
  });
}
