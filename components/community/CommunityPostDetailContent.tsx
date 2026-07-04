import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CommunityPostBody } from '@/components/community/CommunityPostBody';
import { communitySourceLabelId } from '@/components/community/CommunityPostCard';
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

  return (
    <View style={[styles.wrap, { paddingBottom: bottomPad }]}>
      <View style={styles.header}>
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
      gap: 12,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    sourcePill: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    source: {
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
