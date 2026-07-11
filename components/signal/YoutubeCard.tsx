import { FontAwesome } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { openYoutubeItem } from '@/utils/openYoutube';
import type { YoutubeItem } from '@/types/signal';

type Props = {
  item: YoutubeItem;
  layout?: 'card' | 'grouped';
  /** 커스텀 onPress. 없으면 기본 openYoutubeItem 사용 */
  onPress?: (item: YoutubeItem) => void;
};

export function YoutubeCard({ item, layout = 'card', onPress }: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);

  const grouped = layout === 'grouped';

  return (
    <View style={[styles.card, grouped && styles.cardGrouped]}>
      <Pressable
        style={({ pressed }) => [styles.topRow, pressed && styles.pressed]}
        onPress={() => onPress ? onPress(item) : void openYoutubeItem(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${item.channel}`}>
        <View style={styles.thumb}>
          {item.thumbnailUrl ? (
            <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbImg} contentFit="cover" />
          ) : null}
          <Text style={styles.duration}>{item.durationLabel}</Text>
        </View>
        <View style={styles.body}>
          <View style={styles.topicRow}>
            <View style={styles.topicWrap}>
              <Text style={styles.topic} numberOfLines={1}>
                {item.topic}
              </Text>
            </View>
            <Pressable
              onPress={() => void openYoutubeItem(item)}
              style={({ pressed }) => [styles.linkChip, pressed && styles.linkChipPressed]}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              accessibilityRole="link"
              accessibilityLabel={t('youtubeOpenLinkA11y')}>
              <FontAwesome name="external-link" size={10} color={theme.green} />
              <Text style={styles.linkText}>YouTube</Text>
            </Pressable>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.channel} numberOfLines={1}>
            {item.channel}
          </Text>
          <Text style={styles.meta}>
            {t('youtubeMetaViewsLine', { views: item.viewLabel, published: item.publishedLabel })}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  const thumbW = ft.weight === 'bold' ? 136 : 128;
  const thumbH = ft.weight === 'bold' ? 76 : 72;

  return StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      padding: ft.pad(10),
      marginBottom: 14,
    },
    cardGrouped: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderRadius: 0,
      marginBottom: 0,
      paddingHorizontal: ft.pad(14),
      paddingVertical: ft.pad(11),
    },
    topRow: {
      flexDirection: 'row',
      gap: ft.pad(12),
    },
    pressed: {
      opacity: 0.92,
    },
    thumb: {
      width: thumbW,
      height: thumbH,
      borderRadius: 8,
      backgroundColor: '#1A1A24',
      borderWidth: 1,
      borderColor: '#2A2A35',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    thumbImg: {
      ...StyleSheet.absoluteFill,
      borderRadius: 8,
    },
    duration: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      fontSize: ft.ff(10),
      fontWeight: ft.emphasisWeight,
      color: '#fff',
      backgroundColor: 'rgba(0,0,0,0.75)',
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
      overflow: 'hidden',
      zIndex: 2,
    },
    body: {
      flex: 1,
      justifyContent: 'center',
      minWidth: 0,
    },
    topicRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 4,
    },
    topicWrap: {
      flex: 1,
      minWidth: 0,
    },
    topic: {
      alignSelf: 'flex-start',
      fontSize: ft.ff(10),
      fontWeight: ft.emphasisWeight,
      color: theme.green,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      paddingHorizontal: ft.pad(8),
      paddingVertical: ft.pad(3),
      borderRadius: 6,
      overflow: 'hidden',
    },
    title: {
      fontSize: ft.ff(14),
      fontWeight: ft.titleWeight,
      color: theme.text,
      lineHeight: ft.ff(19),
      marginBottom: 4,
    },
    channel: {
      fontSize: ft.ff(12),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
      marginBottom: 2,
    },
    meta: {
      fontSize: ft.ff(11),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
    },
    linkChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
      paddingVertical: 2,
      paddingLeft: 2,
    },
    linkChipPressed: {
      opacity: 0.85,
    },
    linkText: {
      fontSize: ft.ff(10),
      fontWeight: ft.emphasisWeight,
      color: theme.green,
    },
  });
}
