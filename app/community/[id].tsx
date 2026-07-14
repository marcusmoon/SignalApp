import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommunityPostDetailContent } from '@/components/community/CommunityPostDetailContent';
import { communitySourceLabelId } from '@/components/community/CommunityPostCard';
import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { WideSubpaneHeader } from '@/components/layout/WideSubpaneHeader';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import {
  SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL,
  SCREEN_EMBEDDED_WIDE_PADDING_TOP,
} from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { webShellBackground } from '@/constants/webLayout';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { fetchSignalCommunityPost } from '@/integrations/signal-api/community';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { SignalApiCommunityPost } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';

function paramId(raw: string | string[] | undefined): string {
  return String(Array.isArray(raw) ? raw[0] : raw || '').trim();
}

export type CommunityPostContentProps = {
  id: string;
  embedded?: boolean;
  onBack?: () => void;
};

export function CommunityPostContent({ id, embedded = false, onBack }: CommunityPostContentProps) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, embedded),
    [theme, scaleFont, embedded],
  );
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

  return (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['bottom']}>
      {!embedded ? <Stack.Screen options={{ title: screenTitle }} /> : null}
      {onBack ? (
        <View style={styles.headerPad}>
          <WideSubpaneHeader title={screenTitle} onBack={onBack} />
        </View>
      ) : null}
      {loading ? (
        <View style={styles.loadingWrap}>
          <SignalLoadingIndicator message={t('commonLoading')} />
        </View>
      ) : item ? (
        <CommunityPostDetailContent item={item} refreshing={refreshing} onRefresh={onRefresh} />
      ) : (
        <ScrollView
          refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.scrollContent}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!error ? <Text style={styles.empty}>{t('communityEmpty')}</Text> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, embedded: boolean) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: webShellBackground(theme.bg) },
    headerPad: {
      paddingHorizontal: embedded ? SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL : 16,
      paddingTop: embedded ? SCREEN_EMBEDDED_WIDE_PADDING_TOP : 8,
    },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scrollContent: { flexGrow: 1 },
    error: {
      margin: 16,
      padding: 12,
      borderRadius: 8,
      color: theme.danger,
      backgroundColor: theme.dangerDim,
      fontSize: sf(13),
      fontWeight: '600',
    },
    empty: {
      color: theme.textMuted,
      fontSize: sf(14),
      fontWeight: '600',
      textAlign: 'center',
      padding: 20,
    },
  });
}

export default function CommunityPostDetailScreen() {
  const { useTwoPane } = useResponsiveLayout();
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = useMemo(() => paramId(rawId), [rawId]);

  if (useTwoPane) {
    return <WideOverlayRouteRedirect kind="community" params={id ? { id } : {}} />;
  }

  return <CommunityPostContent id={id} />;
}
