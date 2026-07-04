import * as WebBrowser from 'expo-web-browser';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommunityPostDetailContent } from '@/components/community/CommunityPostDetailContent';
import { communitySourceLabelId } from '@/components/community/CommunityPostCard';
import { communityShowsOriginalLink, communitySourceAccent } from '@/constants/communitySources';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
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

  const screenTitle = item ? t(communitySourceLabelId(item.source)) : t('communityDetailTitle');
  const originalUrl = item?.sourceUrl?.trim() || '';
  const showHeaderOriginal =
    item != null && communityShowsOriginalLink(item.source) && originalUrl.length > 0;
  const headerAccent = item ? communitySourceAccent(item.source, theme) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: screenTitle,
          headerRight: showHeaderOriginal
            ? () => (
                <Pressable
                  onPress={() => void WebBrowser.openBrowserAsync(originalUrl)}
                  accessibilityRole="link"
                  accessibilityLabel={t('communityOriginalOpen')}
                  hitSlop={8}
                  style={({ pressed }) => [styles.headerLinkBtn, pressed && styles.headerLinkPressed]}>
                  <FontAwesome name="external-link" size={18} color={headerAccent?.accent ?? theme.green} />
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
    headerLinkBtn: {
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    headerLinkPressed: { opacity: 0.72 },
  });
}
