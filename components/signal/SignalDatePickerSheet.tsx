import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { InvestMonthCalendar } from '@/components/signal/InvestMonthCalendar';
import {
  BOTTOM_SHEET_BACKDROP_COLOR,
  BOTTOM_SHEET_MAX_HEIGHT,
} from '@/constants/bottomSheetLayout';
import type { AppTheme } from '@/constants/theme';
import { UI_RADIUS_SHEET } from '@/constants/uiCornerRadius';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type CalendarMonth = { year: number; month: number };

type SignalDatePickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  selectedYmd: string;
  todayYmd: string;
  maxYmd: string;
  calendarMonth: CalendarMonth;
  eventDates?: Set<string>;
  onSelectYmd: (ymd: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onGoToday: () => void;
};

export function SignalDatePickerSheet({
  visible,
  onClose,
  selectedYmd,
  todayYmd,
  maxYmd,
  calendarMonth,
  eventDates = new Set(),
  onSelectYmd,
  onPrevMonth,
  onNextMonth,
  onGoToday,
}: SignalDatePickerSheetProps) {
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('calendarFilterClose')} />
        <View style={styles.modalSheet}>
          <View style={styles.modalGrab} />
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>{t('insightCalendarTitle')}</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('calendarFilterClose')}
              hitSlop={8}>
              <Text style={styles.modalClose}>{t('calendarFilterClose')}</Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={styles.modalBodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <InvestMonthCalendar
              year={calendarMonth.year}
              month={calendarMonth.month}
              selectedYmd={selectedYmd}
              eventDates={eventDates}
              onSelectYmd={onSelectYmd}
              onPrevMonth={onPrevMonth}
              onNextMonth={onNextMonth}
              monthPrevA11y={t('calendarMonthPrevA11y')}
              monthNextA11y={t('calendarMonthNextA11y')}
              todayYmd={todayYmd}
              maxYmd={maxYmd}
              theme={theme}
              locale={locale}
              compact
            />
          </ScrollView>
          <View style={styles.modalFoot}>
            <Pressable
              onPress={onGoToday}
              accessibilityRole="button"
              style={({ pressed }) => [styles.modalTodayBtn, pressed && styles.pressed]}>
              <FontAwesome name="dot-circle-o" size={14} color={theme.green} />
              <Text style={styles.modalTodayText}>{t('insightCalendarToday')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    modalBackdrop: {
      flex: 1,
      backgroundColor: BOTTOM_SHEET_BACKDROP_COLOR,
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: theme.bg,
      borderTopLeftRadius: UI_RADIUS_SHEET,
      borderTopRightRadius: UI_RADIUS_SHEET,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingBottom: 16,
      maxHeight: BOTTOM_SHEET_MAX_HEIGHT,
    },
    modalGrab: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      marginTop: 16,
      marginBottom: 8,
    },
    modalHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    modalTitle: {
      color: theme.text,
      fontSize: sf(17),
      fontWeight: '700',
    },
    modalClose: {
      color: theme.green,
      fontSize: sf(14),
      fontWeight: '700',
    },
    modalBody: {
      flexGrow: 0,
      flexShrink: 1,
      minHeight: 0,
    },
    modalBodyContent: {
      paddingBottom: 4,
    },
    modalFoot: { paddingTop: 10 },
    modalTodayBtn: {
      minHeight: 42,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    },
    modalTodayText: {
      color: theme.green,
      fontSize: sf(14),
      fontWeight: '700',
    },
    pressed: { opacity: 0.86 },
  });
}
