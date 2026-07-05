import { useCallback, useMemo, useState, type ReactElement } from 'react';

import { SignalDatePickerSheet } from '@/components/signal/SignalDatePickerSheet';
import { monthPartsFromYmd } from '@/utils/date';

type Options = {
  selectedYmd: string;
  todayYmd: string;
  onSelectYmd: (ymd: string) => void;
  maxYmd?: string;
  eventDates?: Set<string>;
};

export function useSignalDatePickerSheet({
  selectedYmd,
  todayYmd,
  onSelectYmd,
  maxYmd,
  eventDates,
}: Options): {
  openDatePicker: () => void;
  datePickerSheet: ReactElement;
} {
  const [visible, setVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => monthPartsFromYmd(selectedYmd));
  const max = maxYmd ?? todayYmd;

  const openDatePicker = useCallback(() => {
    setCalendarMonth(monthPartsFromYmd(selectedYmd));
    setVisible(true);
  }, [selectedYmd]);

  const closeDatePicker = useCallback(() => {
    setVisible(false);
  }, []);

  const pickCalendarDate = useCallback(
    (ymd: string) => {
      onSelectYmd(ymd > max ? max : ymd);
      setVisible(false);
    },
    [max, onSelectYmd],
  );

  const shiftCalendarMonth = useCallback((delta: number) => {
    setCalendarMonth((prev) => {
      const date = new Date(prev.year, prev.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }, []);

  const goTodayInPicker = useCallback(() => {
    onSelectYmd(todayYmd);
    setCalendarMonth(monthPartsFromYmd(todayYmd));
    setVisible(false);
  }, [onSelectYmd, todayYmd]);

  const datePickerSheet = useMemo(
    () => (
      <SignalDatePickerSheet
        visible={visible}
        onClose={closeDatePicker}
        selectedYmd={selectedYmd}
        todayYmd={todayYmd}
        maxYmd={max}
        calendarMonth={calendarMonth}
        eventDates={eventDates}
        onSelectYmd={pickCalendarDate}
        onPrevMonth={() => shiftCalendarMonth(-1)}
        onNextMonth={() => shiftCalendarMonth(1)}
        onGoToday={goTodayInPicker}
      />
    ),
    [
      calendarMonth,
      closeDatePicker,
      eventDates,
      goTodayInPicker,
      max,
      pickCalendarDate,
      selectedYmd,
      shiftCalendarMonth,
      todayYmd,
      visible,
    ],
  );

  return { openDatePicker, datePickerSheet };
}
