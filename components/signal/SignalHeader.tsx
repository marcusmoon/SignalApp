import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  /** SIGNAL 로고 탭 시 (보통 현재 탭 pull-to-refresh와 동일) */
  onBrandPress?: () => void;
  /** 목록형 탭에서 상단 밀도를 낮춘다. */
  compact?: boolean;
};

export function SignalHeader({ onBrandPress, compact = false }: Props) {
  const router = useRouter();
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont, compact), [compact, theme, scaleFont]);
  const brandAccent = theme.green;

  const logo = (
    <>
      <View style={styles.bars}>
        <View style={[styles.bar, { height: compact ? 10 : 12, opacity: 0.38, backgroundColor: brandAccent }]} />
        <View style={[styles.bar, { height: compact ? 15 : 19, opacity: 0.58, backgroundColor: brandAccent }]} />
        <View style={[styles.bar, { height: compact ? 21 : 26, opacity: 0.78, backgroundColor: brandAccent }]} />
        <View style={[styles.bar, { height: compact ? 27 : 33, opacity: 1, backgroundColor: brandAccent }]} />
      </View>
      <View style={styles.brandCol}>
        <Text style={styles.brand}>SIGNAL</Text>
        {!compact ? (
          <Text style={styles.tag} numberOfLines={2}>
            {t('headerTagline')}
          </Text>
        ) : null}
      </View>
    </>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        {onBrandPress ? (
          <Pressable
            onPress={onBrandPress}
            style={({ pressed }) => [styles.logoRow, pressed && styles.logoRowPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('fabRefreshA11y')}>
            {logo}
          </Pressable>
        ) : (
          <View style={styles.logoRow}>{logo}</View>
        )}
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push('/alerts')}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t('a11yAlerts')}>
            <FontAwesome name="bell" size={18} color={theme.textMuted} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/calendar')}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t('a11yCalendar')}>
            <FontAwesome name="calendar" size={18} color={theme.textMuted} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/account')}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t('screenAccount')}>
            <FontAwesome name="user-circle" size={18} color={theme.textMuted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, compact: boolean) {
  return StyleSheet.create({
    wrap: {
      paddingHorizontal: 16,
      paddingTop: compact ? 6 : 8,
      paddingBottom: compact ? 7 : 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.card,
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
      gap: 6,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bgElevated,
    },
    logoRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
    },
    logoRowPressed: {
      opacity: 0.88,
    },
    brandCol: {
      flex: 1,
      minWidth: 0,
    },
    bars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 3,
      height: compact ? 28 : 34,
      flexShrink: 0,
    },
    bar: {
      width: 8,
      borderRadius: 4,
    },
    brand: {
      fontSize: compact ? sf(17) : sf(18),
      fontWeight: '900',
      color: theme.green,
      letterSpacing: 0,
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
