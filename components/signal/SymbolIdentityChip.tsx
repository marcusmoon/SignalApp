import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SymbolLogo } from '@/components/signal/SymbolLogo';
import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';

type Props = {
  symbol: string;
  label: string;
  /** ticker: green tabular · name: body color (국내 회사명 등) */
  labelKind?: 'ticker' | 'name';
  logoSize?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** 긴 이름(국내 회사명)일 때 폭 확장 */
  expandable?: boolean;
};

/**
 * 브리핑·다이제스트 공통 종목 identity 칩.
 * 시장 브리핑 companies · ETF flowHighlights 등에서 동일 밀도·토큰 사용.
 */
export function SymbolIdentityChip({
  symbol,
  label,
  labelKind = 'ticker',
  logoSize = 20,
  onPress,
  accessibilityLabel,
  expandable = false,
}: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const pressable = Boolean(onPress);

  const body = (
    <>
      <SymbolLogo symbol={symbol} size={logoSize} />
      <Text
        style={[
          styles.label,
          labelKind === 'name' ? styles.labelName : styles.labelTicker,
        ]}
        numberOfLines={1}>
        {label}
      </Text>
    </>
  );

  if (pressable) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.chip,
          expandable ? styles.chipExpandable : null,
          pressed ? styles.chipPressed : null,
        ]}
        accessibilityRole="link"
        accessibilityLabel={accessibilityLabel || label}>
        {body}
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.chip, expandable ? styles.chipExpandable : null]}
      accessibilityLabel={accessibilityLabel || label}>
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
    chipExpandable: {
      flexShrink: 1,
      minWidth: 56,
      maxWidth: '58%',
    },
    chipPressed: {
      opacity: 0.72,
    },
    label: {
      fontSize: ft.ff(12),
      letterSpacing: -0.1,
      flexShrink: 1,
      minWidth: 0,
    },
    labelTicker: {
      fontWeight: ft.emphasisWeight,
      color: theme.green,
      fontVariant: ['tabular-nums'],
    },
    labelName: {
      fontWeight: ft.bodyWeight,
      color: theme.text,
    },
  });
}
