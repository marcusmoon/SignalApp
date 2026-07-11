import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

export type DigestSourceSheetRow = {
  key: string;
  title: string;
  subtitle?: string;
  url?: string | null;
};

type Props = {
  visible: boolean;
  digestTitle: string;
  digestSummary?: string;
  rows: DigestSourceSheetRow[];
  onClose: () => void;
};

export function DigestSourcesSheet({
  visible,
  digestTitle,
  digestSummary,
  rows,
  onClose,
}: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const summary = digestSummary?.trim() || '';
  const hasSources = rows.length > 0;

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('filterSheetDismissA11y')}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <View style={styles.grab} />
          <View style={styles.head}>
            <Text style={styles.sheetTitle}>{t('feedDigestDetailTitle')}</Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('filterSheetDone')}>
              <FontAwesome name="times" size={18} color={theme.textMuted} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <Text style={styles.digestTitle}>{digestTitle}</Text>
            {summary ? <Text style={styles.digestSummary}>{summary}</Text> : null}
            {hasSources ? (
              <>
                <Text style={styles.sourcesSection}>{t('feedDigestSourcesTitle')}</Text>
                {rows.map((row) => {
                  const refUrl = row.url || undefined;
                  return (
                    <Pressable
                      key={row.key}
                      onPress={
                        refUrl
                          ? () => {
                              void Linking.openURL(refUrl).catch(() => null);
                            }
                          : undefined
                      }
                      style={({ pressed }) => [styles.row, pressed && refUrl && styles.rowPressed]}
                      accessibilityRole={refUrl ? 'link' : 'text'}>
                      <View style={styles.rowTextCol}>
                        <Text style={[styles.rowTitle, refUrl && styles.rowTitleLink]} numberOfLines={3}>
                          {row.title}
                        </Text>
                        {row.subtitle ? (
                          <Text style={styles.rowSubtitle} numberOfLines={1}>
                            {row.subtitle}
                          </Text>
                        ) : null}
                      </View>
                      {refUrl ? <FontAwesome name="external-link" size={12} color={theme.accentBlue} /> : null}
                    </Pressable>
                  );
                })}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.bg,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: theme.border,
      paddingHorizontal: 16,
      maxHeight: '78%',
    },
    grab: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      marginTop: 16,
      marginBottom: 8,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 20,
      marginBottom: 16,
    },
    sheetTitle: {
      fontSize: sf(12),
      fontWeight: '800',
      color: theme.textMuted,
      letterSpacing: 0.15,
      flex: 1,
    },
    digestTitle: {
      fontSize: sf(17),
      fontWeight: '800',
      color: theme.text,
      lineHeight: sf(24),
    },
    digestSummary: {
      fontSize: sf(14),
      fontWeight: '600',
      color: theme.textMuted,
      lineHeight: sf(21),
    },
    sourcesSection: {
      fontSize: sf(12),
      fontWeight: '800',
      color: theme.textDim,
      letterSpacing: 0.12,
      marginTop: 4,
    },
    closeBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
    },
    closeBtnPressed: {
      opacity: 0.85,
    },
    scroll: {
      flexGrow: 0,
      maxHeight: 480,
    },
    scrollContent: {
      paddingBottom: 8,
      gap: 20,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    rowPressed: {
      opacity: 0.85,
    },
    rowTextCol: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    rowTitle: {
      fontSize: sf(14),
      fontWeight: '700',
      color: theme.text,
      lineHeight: sf(20),
    },
    rowTitleLink: {
      color: theme.accentBlue,
    },
    rowSubtitle: {
      fontSize: sf(11),
      fontWeight: '600',
      color: theme.textMuted,
      lineHeight: sf(15),
    },
  });
}
