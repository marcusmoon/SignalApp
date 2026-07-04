import * as WebBrowser from 'expo-web-browser';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CommunityPostBody } from '@/components/community/CommunityPostBody';
import { communitySourceLabelId } from '@/components/community/CommunityPostCard';
import { communityShowsOriginalLink, communitySourceAccent } from '@/constants/communitySources';
import { APP_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { SignalApiCommunityPost } from '@/integrations/signal-api/types';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { formatInstantLabel, formatRelativeFromIso } from '@/utils/date';

type Props = {
  item: SignalApiCommunityPost;
  bottomPad?: number;
};

export function CommunityPostDetailContent({ item, bottomPad = 24 }: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const accent = useMemo(() => communitySourceAccent(item.source, theme), [item.source, theme]);
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo, accent), [theme, scaleFont, feedTypo, accent]);
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
    <View style={[styles.wrap, { paddingBottom: bottomPad }]}>
      <View style={styles.hero}>
        <View style={styles.metaRow}>
          <View style={styles.sourcePill}>
            <Text style={styles.source}>{t(sourceLabelId)}</Text>
          </View>
          <Text style={styles.time}>{timeLabel}</Text>
        </View>
        <Text style={styles.title}>{item.title}</Text>
      </View>

      {item.body ? (
        <View style={styles.bodyCard}>
          <CommunityPostBody body={item.body} />
        </View>
      ) : null}

      {showOriginalLink ? (
        <Pressable
          onPress={() => void WebBrowser.openBrowserAsync(originalUrl)}
          accessibilityRole="link"
          accessibilityLabel={t('communityOriginalOpen')}
          style={({ pressed }) => [styles.openBtn, pressed && styles.pressed]}>
          <Text style={styles.openText}>{t('communityOriginalOpen')}</Text>
          <FontAwesome name="external-link" size={13} color={accent.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

function makeStyles(
  theme: AppTheme,
  sf: (n: number) => number,
  ft: FeedContentTypography,
  accent: ReturnType<typeof communitySourceAccent>,
) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: 18,
      paddingTop: 12,
      gap: 16,
    },
    hero: {
      gap: 10,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    sourcePill: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: accent.border,
      backgroundColor: accent.dim,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    source: {
      fontSize: ft.ff(11),
      lineHeight: sf(15),
      fontWeight: ft.emphasisWeight,
      color: accent.accent,
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
    title: {
      color: theme.text,
      fontSize: ft.ff(22),
      lineHeight: sf(30),
      fontWeight: ft.titleWeight,
      letterSpacing: -0.2,
    },
    bodyCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: 16,
      paddingVertical: 18,
    },
    openBtn: {
      minHeight: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: accent.border,
      backgroundColor: accent.dim,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    openText: {
      color: accent.accent,
      fontSize: sf(14),
      fontWeight: '900',
    },
    pressed: { opacity: 0.78 },
  });
}
