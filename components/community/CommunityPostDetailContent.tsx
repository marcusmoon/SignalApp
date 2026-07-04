import * as WebBrowser from 'expo-web-browser';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { communitySourceLabelId } from '@/components/community/CommunityPostCard';
import { communityShowsOriginalLink } from '@/constants/communitySources';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { SignalApiCommunityPost } from '@/integrations/signal-api/types';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { formatRelativeFromIso } from '@/utils/date';

type Props = {
  item: SignalApiCommunityPost;
  bottomPad?: number;
};

export function CommunityPostDetailContent({ item, bottomPad = 24 }: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const sourceLabelId = communitySourceLabelId(item.source);
  const timeLabel = item.publishedAt ? formatRelativeFromIso(item.publishedAt, locale) : '—';
  const originalUrl = item.sourceUrl?.trim() || '';
  const showOriginalLink = communityShowsOriginalLink(item.source) && originalUrl.length > 0;

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPad }]}>
      <View style={styles.hero}>
        <View style={styles.metaRow}>
          <Text style={styles.source}>{t(sourceLabelId)}</Text>
          <Text style={styles.time}>{timeLabel}</Text>
        </View>
        <Text style={styles.title}>{item.title}</Text>
      </View>
      {item.body ? (
        <View style={styles.bodyCard}>
          <Text style={styles.body}>{item.body}</Text>
        </View>
      ) : null}
      {showOriginalLink ? (
        <Pressable onPress={() => void WebBrowser.openBrowserAsync(originalUrl)} style={styles.openBtn}>
          <Text style={styles.openText}>{t('communityOriginalOpen')}</Text>
          <FontAwesome name="external-link" size={13} color={theme.green} />
        </Pressable>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    wrap: { padding: 16, gap: 12 },
    hero: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 16,
      gap: 10,
    },
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
      color: theme.text,
      fontSize: ft.ff(20),
      lineHeight: sf(28),
      fontWeight: ft.titleWeight,
    },
    bodyCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 14,
    },
    body: {
      color: theme.text,
      fontSize: ft.ff(15),
      lineHeight: sf(24),
      fontWeight: ft.bodyWeight,
    },
    openBtn: {
      minHeight: 48,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    openText: {
      color: theme.green,
      fontSize: sf(14),
      fontWeight: '900',
    },
  });
}
