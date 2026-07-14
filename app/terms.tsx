import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { WideSubpaneHeader } from '@/components/layout/WideSubpaneHeader';
import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { stackScreenScrollBottomPadding } from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { useIpadSidebarNav } from '@/contexts/IpadSidebarNavContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  fetchSignalLegalTerms,
  fetchSignalMyTerms,
  formatSignalApiError,
  type SignalLegalTerm,
  type SignalUserTermAcceptance,
} from '@/integrations/signal-api';
import { hasSignalApi } from '@/services/env';
import { getSessionAccessToken, loadAppAuthSession } from '@/services/appAuthSession';

type TermsType = 'service' | 'privacy';

export type TermsScreenProps = {
  embedded?: boolean;
  termsType?: TermsType;
  onBack?: () => void;
};

export function TermsContent({
  embedded = false,
  termsType = 'service',
  onBack,
}: TermsScreenProps) {
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const [terms, setTerms] = useState<SignalLegalTerm[]>([]);
  const [acceptanceRows, setAcceptanceRows] = useState<SignalUserTermAcceptance[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const fallback = useMemo<SignalLegalTerm[]>(
    () => [
      {
        id: `service:${locale}`,
        type: 'service',
        locale,
        version: '2026.05.07',
        title: t('termsServiceTitle'),
        body: t('termsServiceBody'),
        required: true,
        active: true,
      },
      {
        id: `privacy:${locale}`,
        type: 'privacy',
        locale,
        version: '2026.05.07',
        title: t('termsPrivacyTitle'),
        body: t('termsPrivacyBody'),
        required: true,
        active: true,
      },
    ],
    [locale, t],
  );

  useEffect(() => {
    let cancelled = false;
    if (!hasSignalApi()) {
      setTerms(fallback);
      return () => {
        cancelled = true;
      };
    }
    fetchSignalLegalTerms(locale)
      .then((rows) => {
        if (!cancelled) setTerms(rows.length > 0 ? rows : fallback);
      })
      .catch(() => {
        if (!cancelled) setTerms(fallback);
      });
    return () => {
      cancelled = true;
    };
  }, [fallback, locale]);

  const loadAcceptanceHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const session = await loadAppAuthSession();
      const access = getSessionAccessToken(session);
      if (!access || !hasSignalApi()) {
        setAcceptanceRows([]);
        return;
      }
      const rows = await fetchSignalMyTerms(access);
      setAcceptanceRows(rows.filter((row) => row.type === termsType));
    } catch (e) {
      setAcceptanceRows([]);
      setHistoryError(formatSignalApiError(e, t, 'termsHistoryError'));
    } finally {
      setHistoryLoading(false);
    }
  }, [t, termsType]);

  useEffect(() => {
    void loadAcceptanceHistory();
  }, [loadAcceptanceHistory]);

  const term = (terms.length > 0 ? terms : fallback).find((item) => item.type === termsType) || fallback[0];
  const title = term.title;
  const body = term.body;

  return (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['bottom']}>
      {!embedded ? <Stack.Screen options={{ title }} /> : null}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: stackScreenScrollBottomPadding(insets.bottom) }]}>
        {onBack ? <WideSubpaneHeader title={title} onBack={onBack} /> : null}
        <View style={styles.card}>
          <Text style={styles.kicker}>{t('termsKicker')}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.updated}>
            {t('termsVersionLabel').replace('{{version}}', term.version)}
            {term.updatedAt ? ` · ${term.updatedAt.slice(0, 10)}` : ''}
          </Text>
        </View>
        <View style={styles.card}>
          {body.split('\n\n').map((paragraph, index) => (
            <Text key={`${termsType}-${index}`} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
        </View>

        <View style={styles.historySection}>
          <Text style={styles.historyKicker}>{t('accountActivityTermsHistory')}</Text>
          {historyError ? <Text style={styles.historyError}>{historyError}</Text> : null}
          {historyLoading ? <Text style={styles.historyEmpty}>{t('commonLoading')}</Text> : null}
          {!historyLoading && acceptanceRows.length === 0 ? (
            <Text style={styles.historyEmpty}>{t('termsHistoryEmpty')}</Text>
          ) : null}
          {!historyLoading && acceptanceRows.length > 0 ? (
            <View style={styles.historyStack}>
              {acceptanceRows.map((item, index) => (
                <View
                  key={item.id}
                  style={[styles.historyRow, index === acceptanceRows.length - 1 && styles.historyRowLast]}>
                  <View style={styles.historyTop}>
                    <Text style={styles.historyVersion}>v{item.version}</Text>
                    <View style={styles.historyBadge}>
                      <Text style={styles.historyBadgeText}>{item.locale.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.historyMeta}>
                    {t('termsHistoryAcceptedAt').replace('{{date}}', item.acceptedAt.slice(0, 10))}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function TermsScreen() {
  const { type, from } = useLocalSearchParams<{ type?: string; from?: string }>();
  const { useTwoPane } = useResponsiveLayout();
  const termsType: TermsType = type === 'privacy' ? 'privacy' : 'service';
  const fromParam = from === 'terms-history' ? 'terms-history' : 'account';

  if (useTwoPane) {
    return <WideOverlayRouteRedirect kind="terms" params={{ type: termsType, from: fromParam }} />;
  }

  return <TermsContent termsType={termsType} />;
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16, gap: 12 },
    card: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 14,
      gap: 10,
    },
    kicker: { color: theme.green, fontSize: sf(11), fontWeight: '700' },
    title: { color: theme.text, fontSize: sf(20), lineHeight: sf(26), fontWeight: '700' },
    updated: { color: theme.textDim, fontSize: sf(11), fontWeight: '600' },
    paragraph: { color: theme.textMuted, fontSize: sf(13), lineHeight: sf(21), fontWeight: '500' },
    historySection: {
      gap: 8,
    },
    historyKicker: {
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
    historyTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    historyVersion: {
      color: theme.text,
      fontSize: sf(13),
      fontWeight: '700',
    },
    historyBadge: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    historyBadgeText: {
      color: theme.green,
      fontSize: sf(10),
      fontWeight: '700',
    },
    historyMeta: {
      color: theme.textDim,
      fontSize: sf(11),
      fontWeight: '600',
    },
    historyEmpty: {
      color: theme.textMuted,
      textAlign: 'center',
      paddingVertical: 10,
      fontSize: sf(12),
      fontWeight: '600',
    },
    historyError: {
      color: theme.danger,
      fontSize: sf(12),
      lineHeight: sf(18),
      fontWeight: '600',
      paddingHorizontal: 4,
    },
  });
}
