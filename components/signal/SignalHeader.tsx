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
            <View style={[styles.bar, { height: 20, opacity: 0.35 }]} />
            <View style={[styles.bar, { height: 34, opacity: 0.6 }]} />
            <View style={[styles.bar, { height: 50, opacity: 0.82 }]} />
            <View style={[styles.bar, { height: 64, opacity: 1 }]} />
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
            <FontAwesome name="bell" size={21} color={theme.textDim} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/calendar')}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t('a11yCalendar')}>
            <FontAwesome name="calendar" size={20} color={theme.textDim} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/settings')}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t('a11ySettings')}>
            <FontAwesome name="cog" size={22} color={theme.textDim} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrap: {
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      marginBottom: 12,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      marginRight: -4,
    },
    iconBtn: {
      padding: 8,
    },
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    bars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 6,
      height: 64,
    },
    bar: {
      width: 12,
      backgroundColor: theme.green,
      borderRadius: 4,
    },
    brand: {
      fontSize: 22,
      fontWeight: '900',
      color: theme.green,
      letterSpacing: -0.5,
    },
    tag: {
      marginTop: 2,
      fontSize: 12,
      color: theme.textDim,
    },
  });
}
