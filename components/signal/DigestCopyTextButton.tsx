import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { formatDigestCopyText } from '@/domain/digests/copyText';
import { copyTextToClipboard } from '@/utils/clipboard';

type Props = {
  title?: string | null;
  summary?: string | null;
  /** compact: icon-only for tight headers */
  compact?: boolean;
};

/**
 * 다이제스트 제목·요약 클립보드 복사.
 * 상세·출처 시트 공통.
 */
export function DigestCopyTextButton({ title, summary, compact = false }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const [copied, setCopied] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const payload = useMemo(() => formatDigestCopyText({ title, summary }), [title, summary]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  const onPress = useCallback(() => {
    if (!payload) return;
    void (async () => {
      const ok = await copyTextToClipboard(payload);
      if (!ok) {
        Alert.alert(t('commonNotice'), t('digestCopyFailed'));
        return;
      }
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => null);
      }
      setCopied(true);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => setCopied(false), 1600);
    })();
  }, [payload, t]);

  if (!payload) return null;

  const label = copied ? t('digestCopyDone') : t('digestCopyText');

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('digestCopyTextA11y')}
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}>
      <FontAwesome
        name={copied ? 'check' : 'copy'}
        size={compact ? 13 : 14}
        color={copied ? theme.green : theme.textMuted}
      />
      {compact ? null : <Text style={[styles.label, copied && styles.labelDone]}>{label}</Text>}
    </Pressable>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
      paddingHorizontal: 2,
    },
    btnPressed: {
      opacity: 0.65,
    },
    label: {
      fontSize: sf(12),
      lineHeight: sf(16),
      fontWeight: '600',
      color: theme.textMuted,
    },
    labelDone: {
      color: theme.green,
    },
  });
}
