import { Image } from 'expo-image';
import { useMemo, useState, useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { SourceAccent } from '@/constants/sourceAccent';
import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { markSourceIconFailed } from '@/services/sourceIcon';

type Props = {
  label: string;
  accent: SourceAccent;
  /** 라벨 숨기고 마크만 */
  iconOnly?: boolean;
  /** accent: 컬러 배지(커뮤니티 등) · news: 뉴스 출처 pill(아이콘+중립 텍스트) */
  variant?: 'accent' | 'news';
  style?: StyleProp<ViewStyle>;
};

export function SourceBadge({
  label,
  accent,
  iconOnly = false,
  variant = 'accent',
  style,
}: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const isNews = variant === 'news';
  const styles = useMemo(() => makeStyles(theme, scaleFont, isNews), [theme, scaleFont, isNews]);
  const iconUrl = accent.iconUrl?.trim() || null;
  const [iconFailed, setIconFailed] = useState(!iconUrl);

  useEffect(() => {
    setIconFailed(!iconUrl);
  }, [iconUrl, label]);

  const showIcon = Boolean(iconUrl) && !iconFailed;

  return (
    <View
      style={[
        styles.pill,
        iconOnly && styles.pillIconOnly,
        iconOnly && isNews && styles.pillIconOnlyNews,
        !iconOnly &&
          (isNews
            ? styles.pillNews
            : { backgroundColor: accent.dim, borderColor: accent.border }),
        style,
      ]}
      accessibilityLabel={label}>
      <View
        style={[
          styles.mark,
          !showIcon && !isNews && { backgroundColor: accent.accent, borderColor: accent.border },
          !showIcon && isNews && { backgroundColor: accent.dim, borderColor: accent.border },
        ]}>
        {showIcon && iconUrl ? (
          <Image
            source={{ uri: iconUrl }}
            style={styles.icon}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={100}
            onError={() => {
              markSourceIconFailed(iconUrl);
              setIconFailed(true);
            }}
          />
        ) : (
          <Text
            style={[styles.glyph, isNews && !showIcon && { color: accent.accent }]}
            numberOfLines={1}>
            {accent.glyph}
          </Text>
        )}
      </View>
      {iconOnly ? null : (
        <Text
          style={[styles.label, isNews ? styles.labelNews : { color: accent.accent }]}
          numberOfLines={1}>
          {label}
        </Text>
      )}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, isNews: boolean) {
  const markSize = isNews ? 16 : 20;
  return StyleSheet.create({
    pill: {
      flexShrink: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      maxWidth: '100%',
      gap: isNews ? 5 : 6,
      paddingLeft: isNews ? 5 : 4,
      paddingRight: isNews ? 8 : 10,
      paddingVertical: isNews ? 3 : 3,
      borderRadius: 999,
      borderWidth: 1,
    },
    pillNews: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      paddingLeft: 0,
      paddingRight: 0,
      paddingVertical: 0,
      gap: 4,
    },
    pillIconOnly: {
      paddingRight: 4,
    },
    pillIconOnlyNews: {
      paddingLeft: 0,
      paddingRight: 0,
      paddingVertical: 0,
      borderWidth: 0,
      backgroundColor: 'transparent',
    },
    mark: {
      width: markSize,
      height: markSize,
      borderRadius: isNews ? 5 : 6,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      overflow: 'hidden',
      flexShrink: 0,
    },
    icon: {
      width: markSize,
      height: markSize,
    },
    glyph: {
      fontSize: sf(isNews ? 8 : 9),
      lineHeight: sf(isNews ? 10 : 11),
      fontWeight: '900',
      color: '#FFFFFF',
      letterSpacing: -0.2,
    },
    label: {
      flexShrink: 1,
      fontSize: sf(isNews ? 11 : 11),
      lineHeight: sf(isNews ? 15 : 15),
      fontWeight: isNews ? '500' : '800',
    },
    labelNews: {
      color: theme.textMuted,
    },
  });
}
