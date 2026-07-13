import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
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

const DOCUMENT_LINKS = [
  { key: 'service', type: 'service' as const, icon: 'file-alt' as const },
  { key: 'privacy', type: 'privacy' as const, icon: 'user-shield' as const },
];

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
      <Stack.Screen options={{ title: t('accountHubTermsTitle') }} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: stackScreenScrollBottomPadding(insets.bottom) }]}>
        <View style={styles.menuStack}>
          {DOCUMENT_LINKS.map((item, index) => {
            const title = item.type === 'service' ? t('termsServiceTitle') : t('termsPrivacyTitle');
            return (
              <Pressable
                key={item.key}
                onPress={() => router.push({ pathname: '/terms', params: { type: item.type } })}
                style={({ pressed }) => [
                  styles.menuRow,
                  index === DOCUMENT_LINKS.length - 1 && styles.menuRowLast,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={title}>
                <View style={styles.menuIcon}>
                  <FontAwesome5 name={item.icon} size={14} color={theme.green} />
                </View>
                <Text style={styles.menuTitle}>{title}</Text>
                <FontAwesome5 name="chevron-right" size={10} color={theme.textDim} />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.historySection}>
          <Text style={styles.sectionKicker}>{t('accountActivityTermsHistory')}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {loading ? <Text style={styles.empty}>{t('commonLoading')}</Text> : null}
          {!loading && rows.length === 0 ? <Text style={styles.empty}>{t('termsHistoryEmpty')}</Text> : null}
          <View style={styles.historyStack}>
            {rows.map((item, index) => (
              <Pressable
                key={item.id}
                onPress={() => router.push({ pathname: '/terms', params: { type: item.type } })}
                style={({ pressed }) => [
                  styles.historyRow,
                  index === rows.length - 1 && styles.historyRowLast,
                  pressed && styles.rowPressed,
                ]}>
                <View style={styles.historyTop}>
                  <Text style={styles.historyTitle}>{item.title}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>v{item.version}</Text>
                  </View>
                </View>
                <Text style={styles.meta}>
                  {item.locale.toUpperCase()} ·{' '}
                  {t('termsHistoryAcceptedAt').replace('{{date}}', item.acceptedAt.slice(0, 10))}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16, gap: 16 },
    menuStack: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      overflow: 'hidden',
    },
    menuRow: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    menuRowLast: {
      borderBottomWidth: 0,
    },
    menuIcon: {
      width: 30,
      height: 30,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    menuTitle: {
      flex: 1,
      color: theme.text,
      fontSize: sf(13),
      fontWeight: '700',
    },
    historySection: {
      gap: 8,
    },
    sectionKicker: {
      paddingHorizontal: 4,
      fontSize: sf(12),
      lineHeight: sf(16),
      fontWeight: '600',
      color: theme.textMuted,
    },
    historyStack: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      overflow: 'hidden',
    },
    historyRow: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    historyRowLast: {
      borderBottomWidth: 0,
    },
    rowPressed: { opacity: 0.76 },
    historyTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    historyTitle: { flex: 1, color: theme.text, fontSize: sf(13), lineHeight: sf(18), fontWeight: '700' },
    badge: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeText: { color: theme.green, fontSize: sf(10), fontWeight: '700' },
    meta: { color: theme.textDim, fontSize: sf(11), fontWeight: '600' },
    empty: {
      color: theme.textMuted,
      textAlign: 'center',
      paddingVertical: 12,
      fontSize: sf(12),
      fontWeight: '600',
    },
    error: { color: theme.danger, fontSize: sf(12), lineHeight: sf(18), fontWeight: '600', paddingHorizontal: 4 },
  });
}
