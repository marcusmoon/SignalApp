import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import type { CommunitySourceKey } from '@/constants/communitySources';
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
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const timeLabel = item.publishedAt ? formatRelativeFromIso(item.publishedAt, locale) : '—';

  return (
    <Pressable
      onPress={() => {
        router.push(`/community/${encodeURIComponent(item.id)}`);
      }}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.metaRow}>
        <Text style={styles.source}>{t(sourceLabelId)}</Text>
        <Text style={styles.time}>{timeLabel}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.body} numberOfLines={6}>
        {item.body}
      </Text>
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

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 8,
    },
    pressed: { opacity: 0.78 },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    source: {
      flexShrink: 1,
      fontSize: ft.ff(11),
      lineHeight: sf(15),
      fontWeight: ft.emphasisWeight,
      color: theme.green,
    },
    time: {
      flexShrink: 0,
      fontSize: ft.ff(11),
      lineHeight: sf(15),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
    },
    title: {
      fontSize: ft.ff(15),
      lineHeight: sf(21),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    body: {
      fontSize: ft.ff(13),
      lineHeight: sf(20),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
    },
  });
}
