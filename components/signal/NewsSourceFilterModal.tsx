import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  sources: string[];
  selected: string[];
  onToggle: (source: string) => void;
  onSelectAll: () => void;
  bottomInset: number;
};

export function NewsSourceFilterModal({
  visible,
  onClose,
  sources,
  selected,
  onToggle,
  onSelectAll,
  bottomInset,
}: Props) {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeModalStyles(theme), [theme]);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modalSheet, { paddingBottom: Math.max(bottomInset, 16) + 8 }]}>
          <View style={styles.modalGrab} />
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>{t('feedNewsFilterTitle')}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('feedNewsFilterClose')}>
              <Text style={styles.modalClose}>{t('feedNewsFilterClose')}</Text>
            </Pressable>
          </View>
          <View style={styles.footerHead}>
            <Text style={styles.footerTitle}>{t('feedNewsFilterIncluded')}</Text>
            <Pressable onPress={onSelectAll} style={styles.allBtn} accessibilityRole="button">
              <Text style={styles.allBtnText}>{t('feedNewsFilterSelectAll')}</Text>
            </Pressable>
          </View>
          <Text style={styles.footerSub}>{t('feedNewsFilterSub')}</Text>
          <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {sources.map((source) => {
              const on = selected.includes(source);
              return (
                <Pressable
                  key={source}
                  onPress={() => onToggle(source)}
                  style={[styles.row, on && styles.rowOn]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}>
                  <FontAwesome
                    name={on ? 'check-square' : 'square-o'}
                    size={15}
                    color={on ? theme.green : theme.textDim}
                    style={styles.checkIcon}
                  />
                  <Text style={[styles.name, !on && styles.nameOff]} numberOfLines={2}>
                    {source}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function makeModalStyles(theme: AppTheme) {
  return StyleSheet.create({
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: theme.bg,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: theme.border,
      paddingHorizontal: 16,
      maxHeight: '78%',
    },
    modalGrab: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      marginTop: 10,
      marginBottom: 6,
    },
    modalHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
      paddingTop: 4,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.text,
    },
    modalClose: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.green,
    },
    footerHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 3,
    },
    footerTitle: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.textMuted,
      letterSpacing: 0.15,
    },
    allBtn: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    allBtnText: {
      fontSize: 10,
      fontWeight: '800',
      color: theme.green,
    },
    footerSub: {
      fontSize: 9,
      color: theme.textDim,
      marginBottom: 6,
      lineHeight: 12,
    },
    modalScroll: {
      flexGrow: 0,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 5,
      paddingHorizontal: 8,
      marginBottom: 3,
      borderRadius: 7,
      backgroundColor: '#14141C',
      borderWidth: 1,
      borderColor: theme.border,
    },
    rowOn: {
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    checkIcon: {
      marginRight: 8,
    },
    name: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
      color: theme.text,
    },
    nameOff: {
      color: theme.textDim,
      fontWeight: '600',
    },
  });
}
