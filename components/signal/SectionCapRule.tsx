import { useMemo, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { FEED_BADGE_PX } from '@/constants/feedTypography';
import { UI_FONT_WEIGHT_EMPHASIS } from '@/constants/uiFontWeight';
import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';

const CAP_RULE_DOT_SIZE = 5;

export type SectionCapRuleProps = {
  label: string;
  /** 우측 as-of 칩 — 홈 시세 레이어 등 */
  meta?: string | null;
  trailing?: ReactNode;
  accessibilityRole?: 'header' | 'text';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  labelNumberOfLines?: number;
};

/** `● 지수 ——` · `● Intraday ——` — 홈 cap rule 공통 */
export function SectionCapRule({
  label,
  meta,
  trailing,
  accessibilityRole = 'text',
  accessibilityLabel,
  style,
  labelNumberOfLines = 1,
}: SectionCapRuleProps) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);

  const title = String(label || '').trim();
  if (!title) return null;

  const metaLabel = String(meta || '').trim();
  const a11y =
    accessibilityLabel ??
    (metaLabel ? `${title}, ${metaLabel}` : title);

  return (
    <View
      style={[styles.row, style]}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={a11y}>
      <View style={styles.lead}>
        <View style={styles.dot} accessibilityElementsHidden importantForAccessibility="no" />
        <Text style={styles.label} numberOfLines={labelNumberOfLines}>
          {title}
        </Text>
      </View>
      <View style={styles.line} />
      {trailing ??
        (metaLabel ? (
          <View style={styles.metaChip}>
            <Text style={styles.metaText} numberOfLines={1}>
              {metaLabel}
            </Text>
          </View>
        ) : null)}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    lead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    },
    dot: {
      width: CAP_RULE_DOT_SIZE,
      height: CAP_RULE_DOT_SIZE,
      borderRadius: CAP_RULE_DOT_SIZE / 2,
      backgroundColor: theme.textMuted,
    },
    label: {
      flexShrink: 0,
      fontSize: sf(12),
      lineHeight: sf(16),
      fontWeight: UI_FONT_WEIGHT_EMPHASIS,
      color: theme.textMuted,
    },
    line: {
      flex: 1,
      minWidth: 16,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
    },
    /** HomeSectionHeader meta / NEW 칩과 동일 톤 */
    metaChip: {
      flexShrink: 0,
      maxWidth: '46%',
      borderRadius: 999,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    metaText: {
      fontSize: ft.ff(FEED_BADGE_PX + 1),
      lineHeight: sf(13),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
      textAlign: 'right',
    },
  });
}
