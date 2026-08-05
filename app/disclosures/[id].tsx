import * as WebBrowser from 'expo-web-browser';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { SymbolIdentityChip } from '@/components/signal/SymbolIdentityChip';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  disclosureMeaningLabelId,
  isImportantDisclosure,
  resolveDisclosureTypeCategory,
} from '@/domain/disclosures';
import { fetchSignalDisclosure } from '@/integrations/signal-api/disclosures';
import type { SignalApiDisclosure } from '@/integrations/signal-api/types';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { hasSignalApi } from '@/services/env';
import { formatLocalInstantDate } from '@/utils/date';

function paramId(raw: string | string[] | undefined): string {
  return String(Array.isArray(raw) ? raw[0] : raw || '').trim();
}

function providerLabel(item: SignalApiDisclosure | null): string {
  if (item?.provider === 'sec') return 'SEC EDGAR';
  if (item?.provider === 'dart') return 'DART';
  return String(item?.provider || '').toUpperCase() || '—';
}

export default function DisclosureDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = useMemo(() => paramId(rawId), [rawId]);
  const insets = useSafeAreaInsets();
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const [item, setItem] = useState<SignalApiDisclosure | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !hasSignalApi()) {
      setItem(null);
      setError(t('errorSignalApiShort'));
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setItem(await fetchSignalDisclosure(id));
    } catch (e) {
      setError(formatSignalApiError(e, t, 'disclosuresLoadError'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: t('disclosuresDetailTitle') }} />
      {loading ? (
        <View style={styles.loadingWrap}>
          <SignalLoadingIndicator message={t('commonLoading')} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 30 + insets.bottom }]}
          refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {item ? (
            <>
              <View style={styles.hero}>
                <View style={styles.badges}>
                  <Text style={styles.badge}>{providerLabel(item)}</Text>
                  {isImportantDisclosure(item) ? (
                    <Text style={styles.badge}>{t('disclosuresImportantBadge')}</Text>
                  ) : null}
                  {(() => {
                    const typeCategory = resolveDisclosureTypeCategory(item);
                    if (typeCategory === 'other') return null;
                    return (
                      <Text style={styles.badgeMuted} numberOfLines={1}>
                        {t(disclosureMeaningLabelId(typeCategory))}
                      </Text>
                    );
                  })()}
                  {item.formType ? <Text style={styles.badgeMuted}>{item.formType}</Text> : null}
                </View>
                <Text style={styles.heroTitle}>{item.title}</Text>
                {item.symbol || item.companyName || item.symbolMeta ? (
                  <View style={styles.companyRow}>
                    {item.symbol ? (
                      <SymbolIdentityChip
                        symbol={item.symbol}
                        identifier={item.symbolMeta?.displaySymbol || item.symbol}
                        name={item.symbolMeta?.name || item.companyName || null}
                        imageUrl={item.symbolMeta?.logoUrl || null}
                        chrome="plain"
                        expandable={Boolean(item.symbolMeta?.name || item.companyName)}
                      />
                    ) : (
                      <Text style={styles.company}>{item.companyName}</Text>
                    )}
                  </View>
                ) : null}
              </View>
              <View style={styles.card}>
                <Text style={styles.section}>{t('disclosuresDetailPoints')}</Text>
                <View style={styles.factRow}>
                  <Text style={styles.factLabel}>{t('disclosuresFiledAt')}</Text>
                  <Text style={styles.factValue}>
                    {formatLocalInstantDate(item.filedAt, locale, {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    })}
                  </Text>
                </View>
                <View style={styles.factRow}>
                  <Text style={styles.factLabel}>{t('disclosuresPeriodEnd')}</Text>
                  <Text style={styles.factValue}>
                    {formatLocalInstantDate(item.periodEndDate, locale, {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    })}
                  </Text>
                </View>
                <View style={styles.factRow}>
                  <Text style={styles.factLabel}>{t('disclosuresFormType')}</Text>
                  <Text style={styles.factValue}>{item.formType || '—'}</Text>
                </View>
              </View>
              {item.summary ? (
                <View style={styles.card}>
                  <Text style={styles.summary}>{item.summary}</Text>
                </View>
              ) : null}
              {item.url ? (
                <Pressable onPress={() => void WebBrowser.openBrowserAsync(item.url!)} style={styles.primaryBtn}>
                  <Text style={styles.primaryText}>{t('disclosuresOriginalOpen')}</Text>
                  <FontAwesome name="external-link" size={13} color="#fff" />
                </Pressable>
              ) : null}
            </>
          ) : (
            <Text style={styles.empty}>{t('disclosuresEmpty')}</Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: 16, gap: 20 },
    error: {
      padding: 12,
      borderRadius: 8,
      color: theme.danger,
      backgroundColor: theme.dangerDim,
      fontSize: sf(13),
      fontWeight: '600',
    },
    empty: { color: theme.textMuted, fontSize: sf(14), fontWeight: '600', textAlign: 'center', padding: 20 },
    hero: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 16,
    },
    badges: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 },
    badge: {
      color: theme.green,
      backgroundColor: theme.greenDim,
      borderColor: theme.greenBorder,
      borderWidth: 1,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 8,
      fontSize: sf(11),
      fontWeight: '700',
      overflow: 'hidden',
    },
    badgeMuted: {
      color: theme.textMuted,
      backgroundColor: theme.bgElevated,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 8,
      fontSize: sf(11),
      fontWeight: '700',
      overflow: 'hidden',
    },
    heroTitle: { color: theme.text, fontSize: sf(20), lineHeight: sf(27), fontWeight: '700' },
    company: { marginTop: 8, color: theme.textMuted, fontSize: sf(13), fontWeight: '600' },
    companyRow: { marginTop: 8, alignSelf: 'flex-start', maxWidth: '100%' },
    card: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 14,
    },
    section: { color: theme.text, fontSize: sf(15), fontWeight: '700', marginBottom: 14 },
    factRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20, paddingVertical: 7 },
    factLabel: { color: theme.textMuted, fontSize: sf(13), fontWeight: '600' },
    factValue: { flex: 1, textAlign: 'right', color: theme.text, fontSize: sf(13), fontWeight: '700' },
    summary: { color: theme.text, fontSize: sf(15), lineHeight: sf(24), fontWeight: '700' },
    primaryBtn: {
      minHeight: 48,
      borderRadius: 8,
      backgroundColor: theme.green,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 16,
    },
    primaryText: { color: '#fff', fontSize: sf(14), fontWeight: '700' },
  });
}
