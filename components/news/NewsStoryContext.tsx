import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchSignalNewsDigestById } from '@/integrations/signal-api/newsDigests';
import type { SignalApiNewsDigestItem } from '@/integrations/signal-api/types';
import { formatFeedItemTimeLabel } from '@/utils/date';
import { openConfiguredExternalLink } from '@/utils/externalLinkOpen';
import { matchingWatchSymbols } from '@/domain/home/newsReading';

export function NewsStoryContext({ item }: { item: SignalApiNewsDigestItem }) {
  const { theme, feedTypo: ft } = useSignalTheme();
  const { t, locale } = useLocale();
  const router = useRouter();
  const [history, setHistory] = useState<SignalApiNewsDigestItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  useEffect(() => { generation.current++; setHistory([]); setBusy(false); setFailed(false); return () => { generation.current++; }; }, [item.id, locale]);
  const previous = history.length ? history[history.length - 1]?.previousDigestId : item.previousDigestId;
  const textStyle = { color: theme.text, fontSize: ft.ff(14), lineHeight: ft.ff(22), fontWeight: ft.bodyWeight };
  async function loadPrevious() {
    if (!previous || busy) return;
    const current = generation.current;
    setBusy(true); setFailed(false);
    try {
      const next = await fetchSignalNewsDigestById(previous, { locale });
      if (current !== generation.current) return;
      if (!next || next.storyId !== item.storyId) throw new Error('Missing history');
      setHistory((rows) => [...rows, next]);
    } catch { if (current === generation.current) setFailed(true); }
    finally { if (current === generation.current) setBusy(false); }
  }
  return <View style={{ gap: 16 }}>
    {item.changes?.length ? <View style={{ gap: 10, borderLeftWidth: 3, borderLeftColor: theme.green, paddingLeft: 12 }}>
      <Text style={{ ...textStyle, color: theme.green, fontWeight: ft.titleWeight }}>{t(item.changeType === 'correction' ? 'newsRevisionCorrection' : item.changeType === 'update' ? 'newsRevisionUpdate' : 'newsRevisionFacts')}</Text>
      {item.changes.map((change, index) => <View key={index} style={{ gap: 4 }}>
        <Text style={textStyle} selectable>{change.text}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {change.sourceIds.map((id) => {
            const ref = item.sourceRefs.find((source) => source.id === id || source.newsId === id);
            return ref?.url ? <Pressable key={id} accessibilityRole="link" onPress={() => void openConfiguredExternalLink({ webUrl: ref.url! }).catch(() => {})} style={{ minHeight: 44, flexDirection: 'row', gap: 5, alignItems: 'center' }}>
              <Ionicons name="open-outline" size={14} color={theme.green} /><Text style={{ ...textStyle, color: theme.green }}>{ref.sourceName || t('feedDigestSourcesTitle')}</Text>
            </Pressable> : null;
          })}
        </View>
      </View>)}
    </View> : null}
    {item.symbols.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {item.symbols.slice(0, 5).map((symbol) => <Pressable key={symbol} accessibilityRole="button" onPress={() => router.push(`/symbol/${encodeURIComponent(symbol)}` as Href)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={{ ...textStyle, color: theme.green }}>{item.keywords?.find((keyword) => matchingWatchSymbols({ symbols: [keyword.symbol || keyword.label || ''] }, [symbol]).length)?.name || symbol}</Text><Ionicons name="chevron-forward" size={14} color={theme.green} />
      </Pressable>)}
    </View> : null}
    {history.map((row) => <View key={row.id} style={{ gap: 4, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12 }}>
      <Text style={{ ...textStyle, color: theme.textMuted }}>{formatFeedItemTimeLabel(row.generatedAt, locale)}</Text>
      <Text style={{ ...textStyle, fontWeight: ft.titleWeight }}>{row.title}</Text><Text style={textStyle}>{row.summary}</Text>
    </View>)}
    {previous ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => void loadPrevious()} style={{ minHeight: 44, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Ionicons name="time-outline" size={18} color={theme.green} /><Text style={{ ...textStyle, color: theme.green }}>{t(busy ? 'commonLoading' : failed ? 'newsHistoryRetry' : 'newsPreviousUpdates')}</Text>
    </Pressable> : null}
  </View>;
}
