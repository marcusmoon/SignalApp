import { FontAwesome } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { youtubeOpenUrl } from '@/lib/youtubeEconomy';
import type { YoutubeItem } from '@/types/signal';

type Props = { item: YoutubeItem };

export function YoutubeCard({ item }: Props) {
  const { theme } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const url = youtubeOpenUrl(item);

  return (
    <View style={styles.card}>
      <Pressable
        style={({ pressed }) => [styles.topRow, pressed && styles.pressed]}
        onPress={() => void WebBrowser.openBrowserAsync(url)}
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
            <Text style={styles.topic}>{item.topic}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.channel} numberOfLines={1}>
            {item.channel}
          </Text>
          <Text style={styles.meta}>
            조회 {item.viewLabel} · {item.publishedLabel}
          </Text>
        </View>
      </Pressable>

      <View style={styles.summaryBox}>
        <View style={styles.summaryHeader}>
          <FontAwesome name="list-ul" size={12} color={theme.green} />
          <Text style={styles.summaryLabel}>영상 요약</Text>
        </View>
        <Text style={styles.summaryHint}>메타데이터·설명 기반 요약 (Claude 또는 폴백)</Text>
        {item.summaryLines.map((line, i) => (
          <Text key={i} style={styles.summaryLine}>
            · {line}
          </Text>
        ))}
        <Pressable
          onPress={() => void WebBrowser.openBrowserAsync(url)}
          style={styles.linkRow}
          accessibilityRole="link"
          accessibilityLabel="유튜브에서 영상 열기">
          <Text style={styles.linkText}>유튜브에서 보기</Text>
          <FontAwesome name="external-link" size={11} color={theme.green} />
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
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
      fontSize: 10,
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
    topicRow: { marginBottom: 4 },
    topic: {
      alignSelf: 'flex-start',
      fontSize: 10,
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
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
      lineHeight: 19,
      marginBottom: 4,
    },
    channel: {
      fontSize: 12,
      color: theme.textMuted,
      marginBottom: 2,
    },
    meta: {
      fontSize: 11,
      color: theme.textDim,
    },
    summaryBox: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    summaryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    summaryLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.2,
    },
    summaryHint: {
      fontSize: 10,
      color: theme.textDim,
      marginBottom: 8,
      lineHeight: 14,
    },
    summaryLine: {
      fontSize: 12,
      color: theme.textMuted,
      lineHeight: 18,
      marginBottom: 5,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      alignSelf: 'flex-start',
    },
    linkText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.green,
    },
  });
}
