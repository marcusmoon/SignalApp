import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { SignalApiNewsDigestItem } from '@/integrations/signal-api/types';
import { savedNewsKey, type SavedNews } from '@/domain/home/newsLibrary';
import { loadSavedNews, subscribeSavedNews, toggleSavedNews } from '@/services/savedNews';

export function SaveNewsButton({ item }: { item: SignalApiNewsDigestItem }) {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const [saved, setSaved] = useState<SavedNews[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void loadSavedNews().then((rows) => { if (active) setSaved(rows); });
    const unsubscribe = subscribeSavedNews(setSaved);
    return () => { active = false; unsubscribe(); };
  }, []);
  const selected = saved.some((row) => savedNewsKey(row.item) === savedNewsKey(item));
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel={t(selected ? 'newsUnsave' : 'newsSave')} accessibilityState={{ selected, busy }} disabled={busy}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
      onPress={() => { setBusy(true); setFailed(false); void toggleSavedNews(item).catch(() => setFailed(true)).finally(() => setBusy(false)); }}>
      <Ionicons name={selected ? 'bookmark' : 'bookmark-outline'} color={theme.green} size={22} />
    </Pressable>
    {failed ? <Text style={{ color: theme.danger }}>{t('newsSaveFailed')}</Text> : null}
  </View>;
}
