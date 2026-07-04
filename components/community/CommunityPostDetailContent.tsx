import * as WebBrowser from 'expo-web-browser';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CommunityPostBody } from '@/components/community/CommunityPostBody';
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

  const sourcePill = (
    <View style={styles.sourcePill}>
      <Text style={styles.source}>{t(sourceLabelId)}</Text>
      {showOriginalLink ? <FontAwesome name="external-link" size={11} color={theme.green} /> : null}
    </View>
  );

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPad }]}>
      <View style={styles.header}>
        <View style={styles.metaRow}>
          <Text style={styles.time}>{timeLabel}</Text>
        </View>
        <View style={styles.titleRow}>
          {showOriginalLink ? (
            <Pressable
              onPress={() => void WebBrowser.openBrowserAsync(originalUrl)}
              accessibilityRole="link"
              accessibilityLabel={t('communityOriginalOpen')}
              hitSlop={6}
              style={({ pressed }) => [pressed && styles.pressed]}>
              {sourcePill}
            </Pressable>
          ) : (
            sourcePill
          )}
          <Text style={styles.title}>{item.title}</Text>
        </View>
      </View>

      {item.body ? (
        <View style={styles.bodyCard}>
          <CommunityPostBody body={item.body} />
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    wrap: {
      paddingHorizontal: 18,
      paddingTop: 12,
      gap: 16,
    },
    header: {
      gap: 8,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    sourcePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      flexShrink: 0,
      marginTop: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    pressed: { opacity: 0.72 },
    source: {
      fontSize: ft.ff(11),
      lineHeight: sf(15),
      fontWeight: ft.emphasisWeight,
      color: theme.green,
    },
    time: {
      fontSize: ft.ff(11),
      lineHeight: sf(15),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
    },
    title: {
      flex: 1,
      flexShrink: 1,
      color: theme.text,
      fontSize: ft.ff(22),
      lineHeight: sf(30),
      fontWeight: ft.titleWeight,
      letterSpacing: -0.2,
    },
    bodyCard: {
      borderRadius: 16,
      backgroundColor: theme.bgElevated,
      paddingHorizontal: 16,
      paddingVertical: 18,
    },
  });
}
