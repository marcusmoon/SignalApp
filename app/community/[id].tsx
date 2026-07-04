import * as WebBrowser from 'expo-web-browser';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommunityPostDetailContent } from '@/components/community/CommunityPostDetailContent';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { communityShowsOriginalLink } from '@/constants/communitySources';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchSignalCommunityPost } from '@/integrations/signal-api/community';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { SignalApiCommunityPost } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';

function paramId(raw: string | string[] | undefined): string {
  return String(Array.isArray(raw) ? raw[0] : raw || '').trim();
}

export default function CommunityPostDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = useMemo(() => paramId(rawId), [rawId]);
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const [item, setItem] = useState<SignalApiCommunityPost | null>(null);
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
      setItem(await fetchSignalCommunityPost(id));
    } catch (e) {
      setItem(null);
      setError(formatSignalApiError(e, t, 'communityErrorLoad'));
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

  const originalUrl = item?.sourceUrl?.trim() || '';
  const showOriginalLink = Boolean(item && communityShowsOriginalLink(item.source) && originalUrl.length > 0);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: t('communityDetailTitle'),
          headerRight: showOriginalLink
            ? () => (
                <Pressable
                  onPress={() => void WebBrowser.openBrowserAsync(originalUrl)}
                  hitSlop={10}
                  accessibilityRole="link"
                  accessibilityLabel={t('communityOriginalOpen')}
                  style={({ pressed }) => [styles.headerLink, pressed && styles.headerLinkPressed]}>
                  <Text style={styles.headerLinkText}>{t('communityOriginalOpen')}</Text>
                  <FontAwesome name="external-link" size={12} color={theme.green} />
                </Pressable>
              )
            : undefined,
        }}
      />
      {loading ? (
        <View style={styles.loadingWrap}>
          <SignalLoadingIndicator message={t('commonLoading')} />
        </View>
      ) : (
        <ScrollView
          refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.scrollContent}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {item ? (
            <CommunityPostDetailContent item={item} />
          ) : !error ? (
            <Text style={styles.empty}>{t('communityEmpty')}</Text>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scrollContent: { flexGrow: 1 },
    error: {
      margin: 16,
      padding: 12,
      borderRadius: 12,
      color: theme.danger,
      backgroundColor: theme.dangerDim,
      fontSize: sf(13),
      fontWeight: '800',
    },
    empty: {
      color: theme.textMuted,
      fontSize: sf(14),
      fontWeight: '800',
      textAlign: 'center',
      padding: 20,
    },
    headerLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingRight: 4,
    },
    headerLinkPressed: { opacity: 0.65 },
    headerLinkText: {
      color: theme.green,
      fontSize: sf(13),
      fontWeight: '800',
    },
  });
}
