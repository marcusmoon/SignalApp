import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { loadNotificationHistory, type StoredNotification } from '@/services/notificationHistory';
import { formatRelativeTime } from '@/utils/date';

export default function AlertsScreen() {
  const { theme } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
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
                    <Text style={styles.highText}>HIGH</Text>
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

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 },
    hint: { fontSize: 11, color: theme.textDim, marginBottom: 12 },
    emptyBox: {
      paddingVertical: 24,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      marginBottom: 12,
    },
    emptyText: { fontSize: 13, color: theme.textMuted, lineHeight: 20, marginBottom: 14 },
    settingsLink: {
      alignSelf: 'flex-start',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 8,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    settingsLinkText: { fontSize: 13, fontWeight: '800', color: theme.green },
    footerLink: {
      marginTop: 8,
      paddingVertical: 12,
      alignItems: 'center',
    },
    footerLinkText: { fontSize: 13, fontWeight: '700', color: theme.green },
    alertCard: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 10,
    },
    alertTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    alertTitle: { fontSize: 13, fontWeight: '700', color: theme.text, flex: 1, paddingRight: 8 },
    alertBody: { fontSize: 12, color: theme.textMuted, lineHeight: 18 },
    time: { fontSize: 11, color: theme.textDim },
    timeRight: { fontSize: 11, color: theme.textDim, marginTop: 6 },
    high: {
      backgroundColor: '#FF3B3B22',
      borderWidth: 1,
      borderColor: '#FF3B3B44',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    highText: { fontSize: 10, fontWeight: '900', color: '#FF6B6B' },
  });
}
