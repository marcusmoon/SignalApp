import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CONTENT_ACCENT_LINE_WIDTH } from '@/constants/homeSectionAccent';
import { communitySourceAccent, type CommunitySourceKey } from '@/constants/communitySources';
import type { AppTheme } from '@/constants/theme';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { SignalApiCommunityPost } from '@/integrations/signal-api/types';
import type { MessageId } from '@/locales/messages';
import { formatRelativeFromIso } from '@/utils/date';

type Props = {
  item: SignalApiCommunityPost;
  sourceLabelId: MessageId;
};

export function CommunityPostCard({ item, sourceLabelId }: Props) {
  const router = useRouter();
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const accent = useMemo(() => communitySourceAccent(item.source, theme), [item.source, theme]);
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo, accent), [theme, scaleFont, feedTypo, accent]);
  const timeLabel = item.publishedAt ? formatRelativeFromIso(item.publishedAt, locale) : '—';

  return (
    <Pressable
      onPress={() => {
        router.push(`/community/${encodeURIComponent(item.id)}`);
      }}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View pointerEvents="none" style={styles.accentBar} />
      <View style={styles.metaRow}>
        <View style={styles.sourcePill}>
          <Text style={styles.sourceName} numberOfLines={1}>
            {t(sourceLabelId)}
          </Text>
        </View>
        <View style={styles.timePill}>
          <Text style={styles.time}>{timeLabel}</Text>
        </View>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
      {item.body ? (
        <Text style={styles.body} numberOfLines={2}>
          {item.body}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function communitySourceLabelId(source: string): MessageId {
  if (source === 'save_user_news') return 'communitySourceSaveUserNews';
  return 'communitySourceNaverLikeusstock';
}

export function isCommunitySourceKey(source: string): source is CommunitySourceKey {
  return source === 'naver_likeusstock_free' || source === 'save_user_news';
}

function makeStyles(
  theme: AppTheme,
  sf: (n: number) => number,
  ft: FeedContentTypography,
  accent: ReturnType<typeof communitySourceAccent>,
) {
  return StyleSheet.create({
    card: {
      position: 'relative',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingLeft: ft.pad(14) + CONTENT_ACCENT_LINE_WIDTH + 6,
      paddingRight: ft.pad(14),
      paddingTop: ft.pad(12),
      paddingBottom: ft.pad(12),
      gap: 6,
      overflow: 'hidden',
    },
    accentBar: {
      position: 'absolute',
      left: 0,
      top: ft.pad(10),
      bottom: ft.pad(10),
      width: CONTENT_ACCENT_LINE_WIDTH,
      borderRadius: 999,
      backgroundColor: accent.accent,
    },
    pressed: { opacity: 0.88 },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: ft.pad(8),
      marginBottom: 2,
    },
    sourcePill: {
      flexShrink: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      maxWidth: '62%',
      paddingHorizontal: ft.pad(10),
      paddingVertical: ft.pad(4),
      borderRadius: 999,
      backgroundColor: accent.dim,
      borderWidth: 1,
      borderColor: accent.border,
    },
    sourceName: {
      flexShrink: 1,
      fontSize: ft.ff(11),
      lineHeight: sf(15),
      fontWeight: ft.emphasisWeight,
      color: accent.accent,
    },
    timePill: {
      flexShrink: 0,
      paddingHorizontal: ft.pad(8),
      paddingVertical: ft.pad(3),
      borderRadius: 999,
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    time: {
      fontSize: ft.ff(10),
      lineHeight: sf(14),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
    title: {
      fontSize: ft.ff(15),
      lineHeight: sf(21),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    body: {
      fontSize: ft.ff(13),
      lineHeight: sf(19),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
    },
  });
}
