import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type ToolbarProps = {
  sectionLabel: string;
  countLabel?: string;
  selectAllLabel: string;
  clearAllLabel: string;
  onSelectAll: () => void;
  onClearAll: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  hint?: string;
  onDone: () => void;
  bottomInset: number;
  toolbar?: ToolbarProps;
  children: ReactNode;
};

export function SelectionFilterToolbar({
  sectionLabel,
  countLabel,
  selectAllLabel,
  clearAllLabel,
  onSelectAll,
  onClearAll,
}: ToolbarProps) {
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makeToolbarStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <View style={styles.wrap}>
      <View style={styles.labelBlock}>
        <Text style={styles.sectionLabel}>{sectionLabel}</Text>
        {countLabel ? <Text style={styles.countLabel}>{countLabel}</Text> : null}
      </View>
      <View style={styles.actions}>
        <Pressable onPress={onClearAll} style={styles.chip} accessibilityRole="button">
          <Text style={styles.chipText}>{clearAllLabel}</Text>
        </Pressable>
        <Pressable onPress={onSelectAll} style={styles.chip} accessibilityRole="button">
          <Text style={styles.chipText}>{selectAllLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function SelectionFilterSheet({
  visible,
  title,
  hint,
  onDone,
  bottomInset,
  toolbar,
  children,
}: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeSheetStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onDone}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel={t('filterSheetDismissA11y')}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(bottomInset, 16) + 12 }]}>
          <View style={styles.grab} />
          <View style={styles.head}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            <Pressable
              onPress={onDone}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('filterSheetDone')}>
              <FontAwesome name="check" size={18} color={theme.green} />
            </Pressable>
          </View>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          {toolbar ? <SelectionFilterToolbar {...toolbar} /> : null}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          <Pressable
            onPress={onDone}
            style={({ pressed }) => [styles.doneBtn, pressed && styles.doneBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('filterSheetDone')}>
            <Text style={styles.doneBtnText}>{t('filterSheetDone')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function selectionFilterRowStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: 12,
      marginBottom: 8,
      borderRadius: 8,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: 52,
    },
    rowOn: {
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    checkIcon: {
      marginRight: 10,
    },
    name: {
      flex: 1,
      fontSize: sf(14),
      fontWeight: '700',
      color: theme.text,
      lineHeight: sf(20),
    },
    nameOff: {
      color: theme.textDim,
      fontWeight: '600',
    },
  });
}

function makeSheetStyles(theme: AppTheme, sf: (n: number) => number) {
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
      maxHeight: '82%',
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
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 20,
      marginBottom: 6,
    },
    title: {
      flex: 1,
      fontSize: sf(18),
      fontWeight: '600',
      color: theme.text,
      lineHeight: sf(24),
    },
    closeBtn: {
      width: 44,
      height: 44,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    closeBtnPressed: {
      opacity: 0.85,
    },
    hint: {
      fontSize: sf(12),
      color: theme.textMuted,
      lineHeight: sf(18),
      marginBottom: 14,
    },
    scroll: {
      flexGrow: 0,
      maxHeight: 390,
    },
    scrollContent: {
      paddingBottom: 8,
    },
    doneBtn: {
      marginTop: 14,
      minHeight: 54,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.green,
    },
    doneBtnPressed: {
      opacity: 0.9,
    },
    doneBtnText: {
      fontSize: sf(16),
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });
}

function makeToolbarStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    wrap: {
      gap: 16,
      marginBottom: 14,
    },
    labelBlock: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 16,
      minWidth: 0,
    },
    sectionLabel: {
      fontSize: sf(12),
      fontWeight: '600',
      color: theme.textMuted,
      letterSpacing: 0.15,
    },
    countLabel: {
      flex: 1,
      fontSize: sf(12),
      fontWeight: '700',
      color: theme.textDim,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    chip: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      minHeight: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipText: {
      fontSize: sf(12),
      fontWeight: '600',
      color: theme.green,
    },
  });
}
