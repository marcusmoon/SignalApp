import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { QuickSettingsSheet } from '@/components/signal/QuickSettingsSheet';

import { APP_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import type { AppTheme } from '@/constants/theme';
import { useFeedUnreadBadges } from '@/contexts/FeedUnreadBadgesContext';
import { useIpadSidebarNavActions } from '@/contexts/IpadSidebarNavContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  /** SIGNAL 로고 탭 시 (보통 현재 탭 pull-to-refresh와 동일) */
  onBrandPress?: () => void;
  /** 목록형 탭에서 상단 밀도를 낮춘다. */
  compact?: boolean;
  /** iPad split layout처럼 헤더가 화면 전체 폭을 써야 하는 경우 */
  fullWidth?: boolean;
};

export function SignalHeader({ onBrandPress, compact = false, fullWidth = false }: Props) {
  const router = useRouter();
  const ipadNav = useIpadSidebarNavActions();
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont, compact, fullWidth), [compact, fullWidth, theme, scaleFont]);
  const brandAccent = theme.green;
  const { alerts: alertsHasUnread } = useFeedUnreadBadges();
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);

  const openQuickSettings = useCallback(() => {
    setQuickSettingsOpen(true);
  }, []);

  const closeQuickSettings = useCallback(() => {
    setQuickSettingsOpen(false);
  }, []);

  const openAlerts = () => {
    if (ipadNav.isAvailable) {
      ipadNav.showAlerts();
      return;
    }
    router.push('/alerts');
  };

  const openCalendar = () => {
    if (ipadNav.isAvailable) {
      ipadNav.showCalendar();
      return;
    }
    router.push('/calendar');
  };

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
    <>
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
              onPress={openAlerts}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={alertsHasUnread ? t('a11yAlertsUnread') : t('a11yAlerts')}>
              <View style={styles.iconBtnInner}>
                <FontAwesome name="bell" size={18} color={theme.textMuted} />
                {alertsHasUnread ? <View style={styles.alertDot} /> : null}
              </View>
            </Pressable>
            <Pressable
              onPress={openCalendar}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={t('a11yCalendar')}>
              <FontAwesome name="calendar" size={18} color={theme.textMuted} />
            </Pressable>
            <Pressable
              onPress={openQuickSettings}
              style={({ pressed }) => [styles.quickSettingsBtn, pressed && styles.quickSettingsBtnPressed]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('a11yQuickSettings')}>
              <Ionicons name="options-outline" size={17} color={theme.textDim} />
            </Pressable>
          </View>
        </View>
      </View>
      <QuickSettingsSheet visible={quickSettingsOpen} onClose={closeQuickSettings} />
    </>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, compact: boolean, fullWidth: boolean) {
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
      width: '100%',
      maxWidth: fullWidth ? undefined : APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
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
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bgElevated,
    },
    quickSettingsBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 2,
    },
    quickSettingsBtnPressed: {
      opacity: 0.72,
    },
    iconBtnInner: {
      width: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    alertDot: {
      position: 'absolute',
      top: -2,
      right: -4,
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: theme.danger,
      borderWidth: 1.5,
      borderColor: theme.card,
    },
    logoRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
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
      fontWeight: '700',
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
