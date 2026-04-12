import { FontAwesome } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { openYoutubeItem } from '@/utils/openYoutube';
import type { YoutubeItem } from '@/types/signal';

type Props = { item: YoutubeItem };

export function YoutubeCard({ item }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <View style={styles.card}>
      <Pressable
        style={({ pressed }) => [styles.topRow, pressed && styles.pressed]}
        onPress={() => void openYoutubeItem(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${item.channel}`}>
        <View style={styles.thumb}>
          {item.thumbnailUrl ? (
            <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbImg} contentFit="cover" />
          ) : null}
          <View style={styles.playCircle}>
            <FontAwesome name="play" size={18} color="#0A0A0F" style={{ marginLeft: 3 }} />
          </View>
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

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 10,
      marginBottom: 10,
    },
    topRow: {
      flexDirection: 'row',
      gap: 12,
    },
    pressed: {
      opacity: 0.92,
    },
    thumb: {
      width: 128,
      height: 72,
      borderRadius: 8,
      backgroundColor: '#1A1A24',
      borderWidth: 1,
      borderColor: '#2A2A35',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    thumbImg: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 8,
    },
    playCircle: {
      position: 'absolute',
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.green,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    duration: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      fontSize: sf(10),
      fontWeight: '800',
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
      gap: 8,
      marginBottom: 4,
    },
    topicWrap: {
      flex: 1,
      minWidth: 0,
    },
    topic: {
      alignSelf: 'flex-start',
      fontSize: sf(10),
      fontWeight: '800',
      color: theme.green,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      overflow: 'hidden',
    },
    title: {
      fontSize: sf(14),
      fontWeight: '700',
      color: theme.text,
      lineHeight: sf(19),
      marginBottom: 4,
    },
    channel: {
      fontSize: sf(12),
      color: theme.textMuted,
      marginBottom: 2,
    },
    meta: {
      fontSize: sf(11),
      color: theme.textDim,
    },
    linkChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 0,
      paddingVertical: 2,
      paddingLeft: 2,
    },
    linkChipPressed: {
      opacity: 0.85,
    },
    linkText: {
      fontSize: sf(10),
      fontWeight: '700',
      color: theme.green,
    },
  });
}
