import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SectionCapRule } from '@/components/signal/SectionCapRule';
import { COMFORT_GAP_SM, COMFORT_PADDING_ROW_V } from '@/constants/comfortDensity';
import {
  HOME_AGENDA_CHIP_PX,
  HOME_AGENDA_TIME_LINE_PX,
  HOME_AGENDA_TIME_PX,
  HOME_AGENDA_TITLE_LINE_PX,
  HOME_AGENDA_TITLE_PX,
  HOME_CARD_PAD_H,
} from '@/constants/homeScan';
import { UI_RADIUS_CARD_LG } from '@/constants/uiCornerRadius';
import type { AppTheme } from '@/constants/theme';
import { calendarTypeAccent } from '@/domain/calendar/typeAccent';
import {
  homeCalendarChipLabel,
  type HomeCalendarAgenda,
} from '@/domain/home/calendarChipLabel';
import { homeCalendarChipShortName } from '@/domain/home/homeCalendarEvents';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { MessageId } from '@/locales/messages';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import type { CalendarEvent } from '@/types/signal';

type Props = {
  agenda: HomeCalendarAgenda;
  selectedYmd: string;
  onPress: () => void;
};

function calendarTypeLabelId(type: CalendarEvent['type']): MessageId {
  if (type === 'earnings') return 'calendarTagEarnings';
  if (type === 'fed') return 'calendarTagFed';
  if (type === 'fomc') return 'calendarTagFomc';
  if (type === 'holiday') return 'calendarTagHoliday';
  return 'calendarTagMacro';
}

function compactTimeLabel(event: CalendarEvent): string {
  const time = String(event.time || '').trim();
  if (time && time !== '—') return time;
  return '';
}

/**
 * Home 일정: 선택일 행 + (오늘일 때) 다가올 D-n 칩. 탭하면 캘린더.
 */
export function HomeCalendarAgenda({ agenda, selectedYmd, onPress }: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo),
    [theme, scaleFont, feedTypo],
  );

  const shortName = (event: CalendarEvent) =>
    homeCalendarChipShortName(event, t(calendarTypeLabelId(event.type)));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('ipadHomeCalendarTitle')}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {agenda.today.map((event, index) => {
        const time = compactTimeLabel(event);
        const accent = calendarTypeAccent(theme, event.type);
        return (
          <View
            key={event.id}
            style={[styles.row, index > 0 && styles.rowRule]}>
            <Text style={styles.time} numberOfLines={1}>
              {time || '—'}
            </Text>
            <View style={[styles.dot, { backgroundColor: accent }]} />
            <Text style={styles.title} numberOfLines={1}>
              {shortName(event)}
            </Text>
          </View>
        );
      })}
      {agenda.today.length > 0 && agenda.upcoming.length > 0 ? (
        <SectionCapRule label={t('homeCalendarUpcoming')} style={styles.upcomingRule} />
      ) : null}
      {agenda.upcoming.length > 0 ? (
        <View style={styles.chipRow}>
          {agenda.upcoming.map((event) => (
            <View key={event.id} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>
                {homeCalendarChipLabel(event, selectedYmd, shortName(event))}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    card: {
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: HOME_CARD_PAD_H,
      paddingVertical: COMFORT_PADDING_ROW_V,
      gap: 2,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 9,
    },
    rowRule: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    time: {
      width: 56,
      fontSize: ft.ff(HOME_AGENDA_TIME_PX),
      lineHeight: ft.ff(HOME_AGENDA_TIME_LINE_PX),
      fontWeight: ft.emphasisWeight,
      color: theme.textMuted,
      fontVariant: ['tabular-nums'],
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      flexShrink: 0,
    },
    title: {
      flex: 1,
      minWidth: 0,
      fontSize: ft.ff(HOME_AGENDA_TITLE_PX),
      lineHeight: ft.ff(HOME_AGENDA_TITLE_LINE_PX),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    upcomingRule: {
      marginTop: 6,
      marginBottom: 4,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: COMFORT_GAP_SM,
      paddingTop: 4,
    },
    chip: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 7,
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      maxWidth: '100%',
    },
    chipText: {
      fontSize: ft.ff(HOME_AGENDA_CHIP_PX),
      lineHeight: sf(16),
      fontWeight: ft.emphasisWeight,
      color: theme.text,
    },
    pressed: {
      opacity: 0.86,
    },
  });
}
