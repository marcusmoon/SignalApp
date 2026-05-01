import { useCallback, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResetRefreshingOnTabBlur } from '@/hooks';
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
  const [refreshing, setRefreshing] = useState(false);
  useResetRefreshingOnTabBlur(setRefreshing);

  const reload = useCallback(async () => {
    const list = await loadNotificationHistory();
    setItems(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  const listHeader = useMemo(
    () => (
      <Text style={styles.hint} accessibilityRole="text">
        {t('alertsListHint')}
      </Text>
    ),
    [styles.hint, t],
  );

  const listFooter = useMemo(
    () =>
      items.length > 0 ? (
        <Pressable
          onPress={() => router.push('/settings?tab=notifications')}
          style={styles.footerLink}
          accessibilityRole="button"
          accessibilityLabel={t('alertsOpenSettings')}>
          <Text style={styles.footerLinkText}>{t('alertsOpenSettings')}</Text>
        </Pressable>
      ) : null,
    [items.length, router, styles.footerLink, styles.footerLinkText, t],
  );

  const renderAlert = useCallback(
    ({ item: a }: { item: StoredNotification }) => (
      <View style={styles.alertCard}>
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
        {a.high ? <Text style={styles.timeRight}>{formatRelativeTime(a.receivedAt, locale)}</Text> : null}
      </View>
    ),
    [locale, styles, t],
  );

  const bottomPad = 28 + insets.bottom;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {isFocused ? <OtaUpdateBanner /> : null}
      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
        renderItem={renderAlert}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
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
        }
        ListFooterComponent={listFooter}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: bottomPad },
          items.length === 0 ? styles.listContentEmpty : null,
        ]}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.green} />}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={12}
        windowSize={7}
      />
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    list: { flex: 1, minHeight: 0 },
    listContent: { paddingHorizontal: 16, paddingTop: 8 },
    listContentEmpty: { flexGrow: 1 },
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
