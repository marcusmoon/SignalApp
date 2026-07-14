import * as WebBrowser from 'expo-web-browser';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { CommunityPostBody } from '@/components/community/CommunityPostBody';
import { communitySourceLabelId } from '@/components/community/CommunityPostCard';
import { SourceBadge } from '@/components/signal/SourceBadge';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { communityShowsOriginalLink, communitySourceAccent } from '@/constants/communitySources';
import { APP_CONTENT_MAX_WIDTH, wideContentFill } from '@/constants/responsiveLayout';
import type { AppTheme } from '@/constants/theme';
import { webScrollViewportStyle } from '@/constants/webLayout';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import type { SignalApiCommunityPost } from '@/integrations/signal-api/types';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { formatInstantLabel, formatRelativeFromIso } from '@/utils/date';

type Props = {
  item: SignalApiCommunityPost;
  bottomPad?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function CommunityPostDetailContent({ item, bottomPad = 24, refreshing = false, onRefresh }: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const { useTwoPane } = useResponsiveLayout();
  const accent = useMemo(() => communitySourceAccent(item.source, theme), [item.source, theme]);
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo, accent, useTwoPane),
    [theme, scaleFont, feedTypo, accent, useTwoPane],
  );
  const sourceLabelId = communitySourceLabelId(item.source);
  const relativeTime = item.publishedAt ? formatRelativeFromIso(item.publishedAt, locale) : '—';
  const absoluteTime = item.publishedAt ? formatInstantLabel(item.publishedAt, locale) : '';
  const timeLabel =
    relativeTime !== '—' && absoluteTime && absoluteTime !== '—'
      ? `${relativeTime} · ${absoluteTime}`
      : relativeTime;
  const originalUrl = item.sourceUrl?.trim() || '';
  const showOriginalLink = communityShowsOriginalLink(item.source) && originalUrl.length > 0;

  return (
    <View style={styles.root}>
      <View style={styles.headerFixed}>
        <View style={styles.headerInner}>
          <View style={styles.metaRow}>
            <SourceBadge label={t(sourceLabelId)} accent={accent} variant="news" />
            <Text style={styles.time}>{timeLabel}</Text>
          </View>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{item.title}</Text>
            {showOriginalLink ? (
              <Pressable
                onPress={() => void WebBrowser.openBrowserAsync(originalUrl)}
                accessibilityRole="link"
                accessibilityLabel={t('communityOriginalOpen')}
                hitSlop={10}
                style={({ pressed }) => [styles.originalLink, pressed && styles.pressed]}>
                <FontAwesome name="external-link" size={11} color={accent.accent} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <WebWheelScrollView
        style={styles.bodyScroll}
        contentContainerStyle={[styles.bodyScrollContent, { paddingBottom: bottomPad }]}
        refreshControl={
          onRefresh ? <ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
        }>
        {item.body ? (
          <View style={styles.bodyCard}>
            <CommunityPostBody body={item.body} />
          </View>
        ) : null}
      </WebWheelScrollView>
    </View>
  );
}

function makeStyles(
  theme: AppTheme,
  sf: (n: number) => number,
  ft: FeedContentTypography,
  accent: ReturnType<typeof communitySourceAccent>,
  useTwoPane: boolean,
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      ...(useTwoPane ? wideContentFill : null),
    },
    headerFixed: {
      flexShrink: 0,
      zIndex: 2,
      elevation: Platform.OS === 'android' ? 2 : 0,
      backgroundColor: theme.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    headerInner: {
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 12,
      gap: 16,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    time: {
      flex: 1,
      minWidth: 0,
      fontSize: ft.ff(11),
      lineHeight: sf(15),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
      textAlign: 'right',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
    },
    title: {
      flex: 1,
      minWidth: 0,
      color: theme.text,
      fontSize: ft.ff(22),
      lineHeight: sf(30),
      fontWeight: ft.titleWeight,
      letterSpacing: -0.2,
    },
    originalLink: {
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 6,
      opacity: 0.92,
    },
    bodyScroll: {
      ...webScrollViewportStyle,
    },
    bodyScrollContent: {
      flexGrow: 1,
      paddingHorizontal: 18,
      paddingTop: 16,
    },
    bodyCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: 16,
      paddingVertical: 18,
    },
    pressed: { opacity: 0.78 },
  });
}
