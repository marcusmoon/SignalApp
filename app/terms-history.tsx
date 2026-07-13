import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { stackScreenScrollBottomPadding } from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  fetchSignalMyTerms,
  formatSignalApiError,
  type SignalUserTermAcceptance,
} from '@/integrations/signal-api';
import { hasSignalApi } from '@/services/env';
import { loadAppAuthSession, getSessionAccessToken } from '@/services/appAuthSession';

export default function TermsHistoryScreen() {
  const router = useRouter();
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const [rows, setRows] = useState<SignalUserTermAcceptance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await loadAppAuthSession();
      const access = getSessionAccessToken(session);
      if (!access || !hasSignalApi()) {
        setRows([]);
        return;
      }
      setRows(await fetchSignalMyTerms(access));
    } catch (e) {
      setError(formatSignalApiError(e, t, 'termsHistoryError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: t('termsHistoryScreenTitle') }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: stackScreenScrollBottomPadding(insets.bottom) }]}>
        <View style={styles.headerCard}>
          <Text style={styles.kicker}>{t('termsHistoryKicker')}</Text>
          <Text style={styles.title}>{t('termsHistoryTitle')}</Text>
          <Text style={styles.summary}>{t('termsHistoryDesc')}</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <Text style={styles.empty}>{t('commonLoading')}</Text> : null}
        {!loading && rows.length === 0 ? <Text style={styles.empty}>{t('termsHistoryEmpty')}</Text> : null}

        {rows.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => router.push({ pathname: '/terms', params: { type: item.type } })}
            style={({ pressed }) => [styles.rowCard, pressed && styles.rowPressed]}>
            <View style={styles.rowTop}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>v{item.version}</Text>
              </View>
            </View>
            <Text style={styles.meta}>
              {item.locale.toUpperCase()} · {t('termsHistoryAcceptedAt').replace('{{date}}', item.acceptedAt.slice(0, 10))}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16, gap: 20 },
    headerCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.card,
      padding: 16,
      gap: 16,
    },
    kicker: { color: theme.green, fontSize: sf(11), fontWeight: '700' },
    title: { color: theme.text, fontSize: sf(20), lineHeight: sf(27), fontWeight: '700' },
    summary: { color: theme.textMuted, fontSize: sf(12), lineHeight: sf(18), fontWeight: '700' },
    rowCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 14,
      gap: 16,
    },
    rowPressed: { opacity: 0.76 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    rowTitle: { flex: 1, color: theme.text, fontSize: sf(14), lineHeight: sf(20), fontWeight: '700' },
    badge: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    badgeText: { color: theme.green, fontSize: sf(10), fontWeight: '700' },
    meta: { color: theme.textDim, fontSize: sf(11), fontWeight: '700' },
    empty: { color: theme.textMuted, textAlign: 'center', marginTop: 20, fontSize: sf(13), fontWeight: '700' },
    error: { color: theme.danger, fontSize: sf(12), lineHeight: sf(18), fontWeight: '600' },
  });
}
