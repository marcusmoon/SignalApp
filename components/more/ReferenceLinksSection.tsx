import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { REFERENCE_LINK_GROUPS } from '@/constants/referenceAppLinks';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { openExternalLink } from '@/utils/openExternalLink';

const LIST_HORIZONTAL_PAD = 16;
const COLS = 4;
const GAP = 8;

export function ReferenceLinksSection() {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const { width: winW } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const cellW = useMemo(() => {
    const inner = winW - LIST_HORIZONTAL_PAD * 2;
    return (inner - GAP * (COLS - 1)) / COLS;
  }, [winW]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>{t('moreRefLinksKicker')}</Text>
      {REFERENCE_LINK_GROUPS.map((group) => (
        <View key={group.id} style={styles.group}>
          <Text style={styles.sectionTitle}>{t(group.sectionTitleKey)}</Text>
          <View style={styles.grid}>
            {group.items.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.cell, { width: cellW }]}
                onPress={() => void openExternalLink(item.webUrl, item.appLaunchUrls)}
                accessibilityRole="button"
                accessibilityLabel={t(item.labelKey)}>
                <View style={styles.iconCircle}>
                  {item.iconMark != null ? (
                    <Text style={styles.iconMarkText} numberOfLines={1}>
                      {item.iconMark}
                    </Text>
                  ) : (
                    <FontAwesome name={item.icon!} size={22} color={theme.green} />
                  )}
                </View>
                <Text style={styles.cellLabel} numberOfLines={2}>
                  {t(item.labelKey)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrap: {
      marginTop: 6,
      paddingTop: 18,
      marginBottom: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    kicker: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.textMuted,
      letterSpacing: 0.2,
      marginBottom: 14,
    },
    group: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 10,
      fontWeight: '800',
      color: theme.textDim,
      letterSpacing: 0.35,
      marginBottom: 10,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GAP,
    },
    cell: {
      alignItems: 'center',
    },
    iconCircle: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      marginBottom: 6,
      paddingHorizontal: 4,
    },
    iconMarkText: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.green,
      letterSpacing: -0.2,
    },
    cellLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
      lineHeight: 13,
      minHeight: 26,
    },
  });
}
