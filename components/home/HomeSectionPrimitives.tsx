import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';

export function StatusPill({
  icon,
  label,
  theme,
  scaleFont,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  theme: AppTheme;
  scaleFont: (n: number) => number;
}) {
  const { feedTypo } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  return (
    <View style={styles.statusPill}>
      <FontAwesome name={icon} size={12} color={theme.green} />
      <Text style={styles.statusPillText}>{label}</Text>
    </View>
  );
}

export function SectionHeader({
  title,
  icon,
  action,
  onPress,
  theme,
  scaleFont,
}: {
  title: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  action: string;
  onPress: () => void;
  theme: AppTheme;
  scaleFont: (n: number) => number;
}) {
  const { feedTypo } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionTitleWrap}>
        <View style={styles.sectionIcon}>
          <FontAwesome name={icon} size={12} color={theme.green} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
        <View style={styles.sectionActionWrap}>
          <Text style={styles.sectionAction}>{action}</Text>
          <FontAwesome name="chevron-right" size={11} color={theme.green} />
        </View>
      </Pressable>
    </View>
  );
}

export function SectionPlaceholder({
  loading,
  emptyText,
  theme,
  scaleFont,
}: {
  loading: boolean;
  emptyText: string;
  theme: AppTheme;
  scaleFont: (n: number) => number;
}) {
  const { t } = useLocale();
  const { feedTypo } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  if (loading) {
    return (
      <View style={styles.inlineLoading}>
        <View style={styles.inlineLoadingDot} />
        <Text style={styles.inlineLoadingText}>{t('commonLoading')}</Text>
      </View>
    );
  }
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{emptyText}</Text>
    </View>
  );
}

export function EvidenceCard({
  icon,
  kind,
  title,
  source,
  timeLabel,
  onPress,
  feedTypo,
  theme,
  scaleFont,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  kind: string;
  title: string;
  source: string;
  timeLabel?: string;
  onPress: () => void;
  feedTypo: FeedContentTypography;
  theme: AppTheme;
  scaleFont: (n: number) => number;
}) {
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const iconSize = feedTypo.weight === 'bold' ? 17 : 16;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.evidenceCard, pressed && styles.pressed]}
      accessibilityRole="button">
      <View style={styles.evidenceIcon}>
        <FontAwesome name={icon} size={iconSize} color={theme.green} />
      </View>
      <View style={styles.evidenceText}>
        <View style={styles.evidenceMetaRow}>
          <Text style={styles.evidenceKind} numberOfLines={1}>
            {kind}
          </Text>
          <Text style={styles.evidenceSource} numberOfLines={1}>
            {source}
          </Text>
          {timeLabel ? (
            <Text style={styles.evidenceTime} numberOfLines={1}>
              {timeLabel}
            </Text>
          ) : null}
        </View>
        <Text style={styles.evidenceTitle} numberOfLines={2}>
          {title}
        </Text>
      </View>
      <FontAwesome name="chevron-right" size={12} color={theme.textDim} />
    </Pressable>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    statusPillText: {
      color: theme.text,
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '800',
      letterSpacing: 0,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 10,
    },
    sectionTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
      flexShrink: 1,
    },
    sectionIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: sf(17),
      lineHeight: sf(22),
      fontWeight: '900',
      letterSpacing: 0,
    },
    sectionActionWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    sectionAction: {
      color: theme.green,
      fontSize: sf(12),
      lineHeight: sf(16),
      fontWeight: '900',
      letterSpacing: 0,
    },
    inlineLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 12,
    },
    inlineLoadingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.green,
      opacity: 0.75,
    },
    inlineLoadingText: {
      color: theme.textDim,
      fontSize: sf(12),
      lineHeight: sf(17),
      fontWeight: '800',
      letterSpacing: 0,
    },
    emptyCard: {
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    emptyText: {
      color: theme.textDim,
      fontSize: sf(12),
      lineHeight: sf(18),
      fontWeight: ft.bodyWeight,
      letterSpacing: 0,
    },
    evidenceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    evidenceIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    evidenceText: { flex: 1, minWidth: 0 },
    evidenceMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
      marginBottom: 3,
    },
    evidenceKind: {
      color: theme.green,
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '900',
      letterSpacing: 0,
    },
    evidenceSource: {
      color: theme.textDim,
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '800',
      letterSpacing: 0,
      flexShrink: 1,
      minWidth: 0,
    },
    evidenceTime: {
      color: theme.textMuted,
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '800',
      letterSpacing: 0,
    },
    evidenceTitle: {
      color: theme.text,
      fontSize: sf(14),
      lineHeight: sf(19),
      fontWeight: ft.titleWeight,
      letterSpacing: 0,
    },
    pressed: { opacity: 0.72 },
  });
}
