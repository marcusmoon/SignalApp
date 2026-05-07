import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchSignalLegalTerms, type SignalLegalTerm } from '@/integrations/signal-api';
import { hasSignalApi } from '@/services/env';

type TermsType = 'service' | 'privacy';

export default function TermsScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const termsType: TermsType = type === 'privacy' ? 'privacy' : 'service';
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const [terms, setTerms] = useState<SignalLegalTerm[]>([]);
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

  const term = (terms.length > 0 ? terms : fallback).find((item) => item.type === termsType) || fallback[0];
  const title = term.title;
  const body = term.body;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 28 + insets.bottom }]}>
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
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16, gap: 12 },
    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 16,
      gap: 8,
    },
    kicker: { color: theme.green, fontSize: sf(11), fontWeight: '900' },
    title: { color: theme.text, fontSize: sf(22), lineHeight: sf(29), fontWeight: '900' },
    updated: { color: theme.textDim, fontSize: sf(11), fontWeight: '700' },
    paragraph: { color: theme.textMuted, fontSize: sf(13), lineHeight: sf(21), fontWeight: '600' },
  });
}
