import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SymbolLogo } from '@/components/signal/SymbolLogo';
import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { isKoreanDisplaySymbol } from '@/domain/symbols/symbolIdentity';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';

type Props = {
  symbol: string;
  identifier?: string;
  name?: string | null;
  logoSize?: number;
  imageUrl?: string | null;
  chrome?: 'card' | 'plain';
  onPress?: () => void;
  accessibilityLabel?: string;
  /** 긴 이름(국내 회사명)일 때 행 안에서 남은 폭을 씀 */
  expandable?: boolean;
};

/**
 * 브리핑·다이제스트 공통 종목 identity 칩.
 * 시장 브리핑 companies · ETF flowHighlights 등에서 동일 밀도·토큰 사용.
 */
export function SymbolIdentityChip({
  symbol,
  identifier,
  name,
  logoSize = 20,
  imageUrl,
  chrome = 'card',
  onPress,
  accessibilityLabel,
  expandable = false,
}: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const pressable = Boolean(onPress);

  const displayIdentifier = String(identifier || symbol || '').trim();
  const displayName = String(name || '').trim();
  const hideIdentifier = isKoreanDisplaySymbol(displayIdentifier || symbol) && Boolean(displayName);
  const body = (
    <>
      <SymbolLogo symbol={symbol} size={logoSize} imageUrl={imageUrl} />
      <View style={[styles.labelRow, expandable ? styles.labelRowExpandable : null]}>
        {!hideIdentifier ? (
          <Text style={[styles.label, styles.labelTicker]} numberOfLines={1}>
            {displayIdentifier}
          </Text>
        ) : null}
        {displayName ? (
          <Text
            style={[styles.label, hideIdentifier ? styles.labelPrimaryName : styles.labelName]}
            numberOfLines={1}>
            {displayName}
          </Text>
        ) : null}
      </View>
    </>
  );

  if (pressable) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.chip,
          chrome === 'plain' ? styles.chipPlain : null,
          expandable ? styles.chipExpandable : null,
          pressed ? styles.chipPressed : null,
        ]}
        accessibilityRole="link"
        accessibilityLabel={accessibilityLabel || [displayIdentifier, displayName].filter(Boolean).join(' ')}>
        {body}
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.chip, chrome === 'plain' ? styles.chipPlain : null, expandable ? styles.chipExpandable : null]}
      accessibilityLabel={accessibilityLabel || [displayIdentifier, displayName].filter(Boolean).join(' ')}>
      {body}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
      minWidth: 72,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 8,
      /** 섹션 카드(`bgElevated`) 위에서 구분되는 칩 — 시장·ETF 공통 */
      backgroundColor: theme.card,
    },
    chipPlain: {
      minWidth: 0,
      paddingVertical: 0,
      paddingHorizontal: 0,
      borderRadius: 0,
      backgroundColor: 'transparent',
    },
    chipExpandable: {
      flex: 1,
      flexShrink: 1,
      minWidth: 96,
      maxWidth: '100%',
    },
    chipPressed: {
      opacity: 0.72,
    },
    label: {
      fontSize: ft.ff(12),
      lineHeight: sf(16),
      letterSpacing: -0.1,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 1,
      minWidth: 0,
    },
    /** 행 레이아웃에서만 남은 폭 채움 — wrap 칩에는 쓰지 않음 */
    labelRowExpandable: {
      flex: 1,
    },
    labelTicker: {
      fontWeight: ft.emphasisWeight,
      color: theme.green,
      fontVariant: ['tabular-nums'],
      flexShrink: 0,
    },
    labelName: {
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
      flexShrink: 1,
      minWidth: 0,
    },
    labelPrimaryName: {
      fontWeight: ft.emphasisWeight,
      color: theme.text,
      flexShrink: 1,
      minWidth: 48,
    },
  });
}
