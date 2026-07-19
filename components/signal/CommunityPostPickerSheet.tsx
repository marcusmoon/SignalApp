import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SelectionFilterSheet, selectionFilterRowStyles } from '@/components/signal/SelectionFilterSheet';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { fetchSignalCommunity } from '@/integrations/signal-api/community';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { SignalApiCommunityPost } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';

export type CommunityPostPickerSelection = {
  id: string;
  title: string;
  source: string;
};

type Props = {
  visible: boolean;
  onSelect: (post: CommunityPostPickerSelection) => void;
  onDismiss: () => void;
  bottomInset: number;
  excludeIds?: string[];
};

export function CommunityPostPickerSheet({
  visible,
  onSelect,
  onDismiss,
  bottomInset,
  excludeIds = [],
}: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const rowStyles = useMemo(() => selectionFilterRowStyles(theme, scaleFont), [theme, scaleFont]);
  const [query, setQuery] = useState('');
  const [draftQuery, setDraftQuery] = useState('');
  const [items, setItems] = useState<SignalApiCommunityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const excluded = useMemo(() => new Set(excludeIds.map((id) => id.trim()).filter(Boolean)), [excludeIds]);

  const load = useCallback(async () => {
    if (!hasSignalApi()) {
      setItems([]);
      setError(t('errorSignalApiShort'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const page = await fetchSignalCommunity(
        { q: query.trim() || undefined, limit: 40, offset: 0 },
        { cacheMode: signalCacheMode() },
      );
      setItems(page.items.filter((row) => row.id && !excluded.has(row.id)));
    } catch (e) {
      setError(formatSignalApiError(e, t, 'ipadHomeLoadError'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [excluded, query, t]);

  useEffect(() => {
    if (!visible) return;
    setDraftQuery('');
    setQuery('');
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    void load();
  }, [load, visible]);

  return (
    <SelectionFilterSheet
      visible={visible}
      title={t('homeShortcutPickBoardPostTitle')}
      hint={t('homeShortcutPickBoardPostHint')}
      onDone={onDismiss}
      bottomInset={bottomInset}>
      <View style={styles.searchRow}>
        <TextInput
          value={draftQuery}
          onChangeText={setDraftQuery}
          placeholder={t('homeShortcutPickBoardPostSearch')}
          placeholderTextColor={theme.textDim}
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={() => setQuery(draftQuery.trim())}
        />
        <Pressable
          onPress={() => setQuery(draftQuery.trim())}
          style={({ pressed }) => [styles.searchBtn, pressed && styles.searchBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel={t('homeShortcutPickBoardPostSearch')}>
          <FontAwesome name="search" size={16} color={theme.green} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.green} />
        </View>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!loading && !error && items.length === 0 ? (
        <Text style={styles.emptyText}>{t('homeShortcutPickBoardPostEmpty')}</Text>
      ) : null}

      {items.map((item) => {
        const title = item.title?.trim() || t('homeShortcutBoardPost');
        return (
          <Pressable
            key={item.id}
            onPress={() =>
              onSelect({
                id: item.id,
                title,
                source: item.source || '',
              })
            }
            style={({ pressed }) => [rowStyles.row, pressed && rowStyles.rowOn]}
            accessibilityRole="button"
            accessibilityLabel={title}>
            <Text style={rowStyles.name} numberOfLines={2}>
              {title}
            </Text>
            <FontAwesome name="chevron-right" size={14} color={theme.textDim} />
          </Pressable>
        );
      })}
    </SelectionFilterSheet>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    searchInput: {
      flex: 1,
      minHeight: 42,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      paddingHorizontal: 12,
      fontSize: sf(14),
      color: theme.text,
    },
    searchBtn: {
      width: 42,
      height: 42,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchBtnPressed: {
      opacity: 0.88,
    },
    center: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    errorText: {
      fontSize: sf(13),
      color: theme.danger,
      marginBottom: 10,
    },
    emptyText: {
      fontSize: sf(13),
      color: theme.textDim,
      textAlign: 'center',
      paddingVertical: 20,
    },
  });
}
