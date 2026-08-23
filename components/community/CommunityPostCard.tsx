import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  FEED_ARTICLE_TITLE_PX,
  FEED_META_TIME_PX,
  FEED_PREVIEW_BODY_PX,
} from '@/constants/feedTypography';
import { communitySourceAccent, isCommunitySourceKey } from '@/constants/communitySources';
import { CommunitySourceMark } from '@/components/signal/CommunitySourceMark';
import type { AppTheme } from '@/constants/theme';
import { UI_RADIUS_CARD } from '@/constants/uiCornerRadius';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { SignalApiCommunityPost } from '@/integrations/signal-api/types';
import type { MessageId } from '@/locales/messages';
import { formatFeedItemTimeLabel } from '@/utils/date';

type Props = {
  item: SignalApiCommunityPost;
  sourceLabelId: MessageId;
  /** 전체 탭 등 출처 구분이 필요할 때만 표시 */
  showSource?: boolean;
  /** 0이면 본문 숨김 */
  bodyLines?: number;
  /** Wide pane drill-in — when set, skips default stack push. */
  onPress?: () => void;
};

export function CommunityPostCard({
  item,
  sourceLabelId,
  showSource = true,
  bodyLines = 2,
  onPress,
}: Props) {
  const router = useRouter();
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const accent = useMemo(() => communitySourceAccent(item.source, theme), [item.source, theme]);
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const timeLabel = formatFeedItemTimeLabel(item.publishedAt, locale);

  return (
    <Pressable
      onPress={() => {
        if (onPress) {
          onPress();
          return;
        }
        router.push(`/community/${encodeURIComponent(item.id)}`);
      }}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
      {item.body && bodyLines > 0 ? (
        <Text style={styles.body} numberOfLines={bodyLines}>
          {item.body}
        </Text>
      ) : null}
      <View style={styles.footer}>
        {showSource ? (
          <View style={styles.footerLead}>
            <CommunitySourceMark accent={accent} size={18} />
            <Text style={styles.sourceLabel} numberOfLines={1}>
              {t(sourceLabelId)}
            </Text>
          </View>
        ) : (
          <View style={styles.footerLead} />
        )}
        {timeLabel && timeLabel !== '—' ? (
          <Text style={styles.time} numberOfLines={1}>
            {timeLabel}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export { isCommunitySourceKey };

export function communitySourceLabelId(source: string): MessageId {
  if (source === 'naver_yamizal_free') return 'communitySourceNaverYamizal';
  if (source === 'motley_fool_investing') return 'communitySourceMotleyFool';
  return 'communitySourceNaverLikeusstock';
}

function makeStyles(
  theme: AppTheme,
  sf: (n: number) => number,
  ft: FeedContentTypography,
) {
  return StyleSheet.create({
    card: {
      position: 'relative',
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingLeft: ft.pad(14),
      paddingRight: ft.pad(14),
      paddingTop: ft.pad(12),
      paddingBottom: ft.pad(12),
      gap: 8,
      overflow: 'hidden',
    },
    pressed: { opacity: 0.88 },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: ft.pad(8),
      minWidth: 0,
      marginTop: 2,
    },
    footerLead: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sourceLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: ft.ff(FEED_META_TIME_PX),
      lineHeight: sf(12),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
    },
    time: {
      flexShrink: 0,
      fontSize: ft.ff(FEED_META_TIME_PX),
      lineHeight: sf(13),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
    },
    title: {
      fontSize: ft.ff(FEED_ARTICLE_TITLE_PX),
      lineHeight: sf(21),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    body: {
      fontSize: ft.ff(FEED_PREVIEW_BODY_PX),
      lineHeight: sf(19),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
    },
  });
}
