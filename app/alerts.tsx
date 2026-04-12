import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { loadNotificationHistory, type StoredNotification } from '@/services/notificationHistory';
import { formatRelativeTime } from '@/utils/date';

export default function AlertsScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const router = useRouter();
  const [items, setItems] = useState<StoredNotification[]>([]);

  const reload = useCallback(async () => {
    const list = await loadNotificationHistory();
    setItems(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {isFocused ? <OtaUpdateBanner /> : null}
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 28 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.hint}>{t('alertsListHint')}</Text>

        {items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{t('alertsEmpty')}</Text>
            <Pressable
              onPress={() => router.push('/settings?tab=notifications')}
              style={styles.settingsLink}
              accessibilityRole="button"
              accessibilityLabel={t('alertsOpenSettings')}>
              <Text style={styles.settingsLinkText}>{t('alertsOpenSettings')}</Text>
            </Pressable>
          </View>
        ) : (
          items.map((a) => (
            <View key={a.id} style={styles.alertCard}>
              <View style={styles.alertTop}>
                <Text style={styles.alertTitle}>{a.title}</Text>
                {a.high ? (
                  <View style={styles.high}>
                    <Text style={styles.highText}>{t('alertsHighBadge')}</Text>
                  </View>
                ) : (
                  <Text style={styles.time}>{formatRelativeTime(a.receivedAt, locale)}</Text>
                )}
              </View>
              <Text style={styles.alertBody}>{a.body}</Text>
              {a.high ? (
                <Text style={styles.timeRight}>{formatRelativeTime(a.receivedAt, locale)}</Text>
              ) : null}
            </View>
          ))
        )}

        {items.length > 0 ? (
          <Pressable
            onPress={() => router.push('/settings?tab=notifications')}
            style={styles.footerLink}
            accessibilityRole="button"
            accessibilityLabel={t('alertsOpenSettings')}>
            <Text style={styles.footerLinkText}>{t('alertsOpenSettings')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 },
    hint: { fontSize: sf(11), color: theme.textDim, marginBottom: 12 },
    emptyBox: {
      paddingVertical: 24,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      marginBottom: 12,
    },
    emptyText: { fontSize: sf(13), color: theme.textMuted, lineHeight: sf(20), marginBottom: 14 },
    settingsLink: {
      alignSelf: 'flex-start',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 8,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    settingsLinkText: { fontSize: sf(13), fontWeight: '800', color: theme.green },
    footerLink: {
      marginTop: 8,
      paddingVertical: 12,
      alignItems: 'center',
    },
    footerLinkText: { fontSize: sf(13), fontWeight: '700', color: theme.green },
    alertCard: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 10,
    },
    alertTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    alertTitle: { fontSize: sf(13), fontWeight: '700', color: theme.text, flex: 1, paddingRight: 8 },
    alertBody: { fontSize: sf(12), color: theme.textMuted, lineHeight: sf(18) },
    time: { fontSize: sf(11), color: theme.textDim },
    timeRight: { fontSize: sf(11), color: theme.textDim, marginTop: 6 },
    high: {
      backgroundColor: '#FF3B3B22',
      borderWidth: 1,
      borderColor: '#FF3B3B44',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    highText: { fontSize: sf(10), fontWeight: '900', color: '#FF6B6B' },
  });
}
