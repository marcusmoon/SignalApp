import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  buildConcallYearOptions,
  type ConcallFiscalState,
  type FiscalQuarterFilter,
} from '@/domain/concalls';

type Props = {
  visible: boolean;
  onClose: () => void;
  appliedFiscal: ConcallFiscalState;
  /** 연도·분기 — 조회 시 저장·반영 (실적 범위는 설정에서) */
  onApplyQuery: (fiscal: ConcallFiscalState) => void | Promise<void>;
  bottomInset: number;
};

export function ConcallFiscalFilterModal({
  visible,
  onClose,
  appliedFiscal,
  onApplyQuery,
  bottomInset,
}: Props) {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeModalStyles(theme), [theme]);
  const [draft, setDraft] = useState<ConcallFiscalState>(appliedFiscal);
  const [pickerOpen, setPickerOpen] = useState<'year' | 'quarter' | null>(null);

  useEffect(() => {
    if (visible) {
      setDraft(appliedFiscal);
      setPickerOpen(null);
    }
  }, [visible, appliedFiscal]);

  const yearOptions = useMemo(() => buildConcallYearOptions(), []);
  const quarterOptions = useMemo(
    () =>
      ([0, 1, 2, 3, 4] as const).map((q) => ({
        value: q as FiscalQuarterFilter,
        label: q === 0 ? t('callsFiscalAll') : t('callsFiscalQuarterN', { q }),
      })),
    [t],
  );

  const quarterLabel =
    draft.fiscalQuarter === 0 ? t('callsFiscalAll') : t('callsFiscalQuarterN', { q: draft.fiscalQuarter });

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modalSheet, { paddingBottom: Math.max(bottomInset, 16) + 8 }]}>
          <View style={styles.modalGrab} />
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>{t('callsFilterTitle')}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('callsFilterClose')}>
              <Text style={styles.modalClose}>{t('callsFilterClose')}</Text>
            </Pressable>
          </View>

          <Text style={styles.footerSub}>{t('callsModalFiscalLead')}</Text>

          <View style={styles.fiscalOneRow}>
            <Text style={styles.fiscalInlineLbl}>{t('callsFiscalYearShort')}</Text>
            <Pressable
              onPress={() => setPickerOpen('year')}
              style={({ pressed }) => [styles.combo, styles.comboFlex, pressed && styles.comboPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('callsFiscalYear')}
              hitSlop={6}>
              <Text style={styles.comboValue} numberOfLines={1}>
                {draft.fiscalYear}
              </Text>
              <FontAwesome name="caret-down" size={13} color={theme.green} />
            </Pressable>

            <Text style={styles.fiscalInlineLbl}>{t('callsFiscalQuarterShort')}</Text>
            <Pressable
              onPress={() => setPickerOpen('quarter')}
              style={({ pressed }) => [styles.combo, styles.comboFlex, pressed && styles.comboPressed]}
              accessibilityRole="button"
              accessibilityLabel={t('callsFiscalQuarter')}
              hitSlop={6}>
              <Text style={styles.comboValue} numberOfLines={1}>
                {quarterLabel}
              </Text>
              <FontAwesome name="caret-down" size={13} color={theme.green} />
            </Pressable>
          </View>

          <Pressable
            onPress={() => void onApplyQuery(draft)}
            style={({ pressed }) => [styles.queryBtn, pressed && styles.queryBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('callsFilterQuery')}>
            <FontAwesome name="search" size={14} color="#0A0A0F" style={styles.queryIcon} />
            <Text style={styles.queryBtnText}>{t('callsFilterQuery')}</Text>
          </Pressable>
        </View>

        {pickerOpen !== null ? (
          <View style={styles.pickerOverlay} pointerEvents="box-none">
            <Pressable style={styles.pickerDim} onPress={() => setPickerOpen(null)} />
            <View style={[styles.pickerSheet, { paddingBottom: Math.max(bottomInset, 20) }]}>
              <Text style={styles.pickerTitle}>
                {pickerOpen === 'year' ? t('callsFiscalYear') : t('callsFiscalQuarter')}
              </Text>
              {pickerOpen === 'year' ? (
                <FlatList
                  data={yearOptions}
                  keyExtractor={(y) => String(y)}
                  style={styles.pickerList}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  renderItem={({ item }) => {
                    const on = draft.fiscalYear === item;
                    return (
                      <Pressable
                        onPress={() => {
                          setDraft((d) => ({ ...d, fiscalYear: item }));
                          setPickerOpen(null);
                        }}
                        style={({ pressed }) => [
                          styles.pickerRow,
                          on && styles.pickerRowOn,
                          pressed && styles.pickerRowPressed,
                        ]}>
                        <Text style={[styles.pickerRowText, on && styles.pickerRowTextOn]}>{item}</Text>
                        {on ? <FontAwesome name="check" size={14} color={theme.green} /> : null}
                      </Pressable>
                    );
                  }}
                />
              ) : null}
              {pickerOpen === 'quarter' ? (
                <FlatList
                  data={quarterOptions}
                  keyExtractor={(o) => String(o.value)}
                  style={styles.pickerList}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  renderItem={({ item }) => {
                    const on = draft.fiscalQuarter === item.value;
                    return (
                      <Pressable
                        onPress={() => {
                          setDraft((d) => ({ ...d, fiscalQuarter: item.value }));
                          setPickerOpen(null);
                        }}
                        style={({ pressed }) => [
                          styles.pickerRow,
                          on && styles.pickerRowOn,
                          pressed && styles.pickerRowPressed,
                        ]}>
                        <Text style={[styles.pickerRowText, on && styles.pickerRowTextOn]}>{item.label}</Text>
                        {on ? <FontAwesome name="check" size={14} color={theme.green} /> : null}
                      </Pressable>
                    );
                  }}
                />
              ) : null}
            </View>
          </View>
        ) : null}
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
      maxHeight: '70%',
      zIndex: 1,
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
      marginBottom: 6,
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
    footerSub: {
      fontSize: 10,
      color: theme.textDim,
      marginBottom: 12,
      lineHeight: 14,
    },
    fiscalOneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 12,
    },
    fiscalInlineLbl: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.textMuted,
      minWidth: 28,
    },
    combo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: Platform.OS === 'web' ? 9 : 10,
      borderRadius: 10,
      backgroundColor: '#14141C',
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: 44,
    },
    comboFlex: {
      flex: 1,
      minWidth: 72,
      maxWidth: 140,
    },
    comboPressed: {
      opacity: 0.88,
    },
    comboValue: {
      flex: 1,
      fontSize: 14,
      fontWeight: '800',
      color: theme.text,
    },
    queryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: theme.green,
    },
    queryBtnPressed: { opacity: 0.9 },
    queryIcon: { marginTop: 1 },
    queryBtnText: { fontSize: 15, fontWeight: '800', color: '#0A0A0F' },
    pickerOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 50,
      elevation: 50,
    },
    pickerDim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    pickerSheet: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 24,
      maxHeight: '55%',
      backgroundColor: theme.bg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      paddingTop: 12,
      paddingHorizontal: 8,
      zIndex: 51,
      elevation: 51,
    },
    pickerTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.textMuted,
      paddingHorizontal: 10,
      marginBottom: 8,
    },
    pickerList: {
      maxHeight: 280,
    },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 10,
      marginHorizontal: 4,
      marginBottom: 2,
    },
    pickerRowOn: {
      backgroundColor: theme.greenDim,
    },
    pickerRowPressed: {
      opacity: 0.85,
    },
    pickerRowText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
    },
    pickerRowTextOn: {
      color: theme.green,
    },
  });
}
