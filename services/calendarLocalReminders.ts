import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { normalizeEarningsSymbolForMatch } from '@/constants/megaCapUniverse';
import {
  earningsRowDate,
  earningsRowHour,
  earningsRowQuarter,
  earningsRowSymbol,
  earningsRowYear,
} from '@/domain/concalls/signalCalendarEarnings';
import {
  fetchSignalEarningsCalendarRangeMerged,
  fetchSignalMacroCalendarRangeMerged,
} from '@/integrations/signal-api/calendarRange';
import type { SignalApiCalendarEvent } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';
import type { NotificationPrefs } from '@/services/notificationPreferences';
import { addDays, toYmd } from '@/utils/date';

const DATA_KIND = 'signal_calendar_local';

function calendarEventToLocalDate(ev: SignalApiCalendarEvent): Date | null {
  const iso = ev.eventAt?.trim();
  if (iso && iso.includes('T')) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (ev.date && ev.timeLabel) {
    const d = new Date(`${ev.date}T${ev.timeLabel}:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (ev.date) {
    const d = new Date(`${ev.date}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function safeNotifyId(s: string): string {
  return `signal-cal-${s.replace(/[^a-zA-Z0-9_-]/g, '_')}`.slice(0, 120);
}

/** ymd(로컬) 오전 hour:minute */
function localDayTrigger(ymd: string, hour: number, minute: number): Date | null {
  const p = ymd.split('-').map(Number);
  if (p.length !== 3 || p.some((n) => !Number.isFinite(n))) return null;
  const d = new Date(p[0], p[1] - 1, p[2], hour, minute, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function requestLocalCalendarNotifyPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const cur = await Notifications.getPermissionsAsync();
  if (cur.status === 'granted') return true;
  const next = await Notifications.requestPermissionsAsync();
  return next.status === 'granted';
}

async function cancelOurScheduled(): Promise<void> {
  if (Platform.OS === 'web') return;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of all) {
    const data = n.content.data as Record<string, unknown> | undefined;
    if (data?.kind === DATA_KIND) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

function uniqMacroByTitle(rows: SignalApiCalendarEvent[]): SignalApiCalendarEvent[] {
  const m = new Map<string, SignalApiCalendarEvent>();
  for (const r of rows) {
    const title = String(r.title || '').trim();
    const k = `${title}|${r.country ?? ''}`;
    if (!m.has(k)) m.set(k, r);
  }
  return [...m.values()];
}

/**
 * 경제 지표는 날짜당 1건(당일 08:00 로컬), 관심 실적은 날짜당 1건(07:30 로컬)으로 묶어 등록합니다. 최대 24건.
 */
export async function syncCalendarLocalReminders(
  prefs: Pick<NotificationPrefs, 'localMacroCalendar' | 'localWatchlistEarnings'>,
  watchlistSymbols: string[],
): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!hasSignalApi()) return;
  await cancelOurScheduled();
  if (!prefs.localMacroCalendar && !prefs.localWatchlistEarnings) return;

  const granted = await requestLocalCalendarNotifyPermission();
  if (!granted) return;

  const today = startOfLocalDay(new Date());
  const until = addDays(today, 10);
  const watchSet = new Set(
    watchlistSymbols.map((s) => normalizeEarningsSymbolForMatch(s.trim().toUpperCase())).filter(Boolean),
  );

  type Sched = { id: string; when: Date; title: string; body: string };
  const items: Sched[] = [];

  if (prefs.localMacroCalendar) {
    try {
      const eco = await fetchSignalMacroCalendarRangeMerged(today, until);
      const byYmd = new Map<string, SignalApiCalendarEvent[]>();
      for (const row of eco) {
        const dt = calendarEventToLocalDate(row);
        if (!dt) continue;
        const ymd = toYmd(startOfLocalDay(dt));
        const arr = byYmd.get(ymd) ?? [];
        arr.push(row);
        byYmd.set(ymd, arr);
      }
      for (const [ymd, rows] of byYmd) {
        const uniq = uniqMacroByTitle(rows).slice(0, 8);
        if (uniq.length === 0) continue;
        const when = localDayTrigger(ymd, 8, 0);
        if (!when || when.getTime() <= Date.now()) continue;
        const title = uniq.length === 1 ? String(uniq[0].title || '').trim() || 'Macro' : `Macro · ${ymd}`;
        const body = uniq
          .map((r) => `• ${String(r.title || '').trim()}${r.country ? ` (${r.country})` : ''}`)
          .join('\n')
          .slice(0, 380);
        items.push({ id: `eco-day-${ymd}`, when, title, body });
      }
    } catch {
      /* ignore */
    }
  }

  if (prefs.localWatchlistEarnings && watchSet.size > 0) {
    try {
      const earn = await fetchSignalEarningsCalendarRangeMerged(today, until);
      const relevant = earn.filter(
        (r) => earningsRowSymbol(r) && watchSet.has(normalizeEarningsSymbolForMatch(earningsRowSymbol(r))),
      );
      const byYmd = new Map<string, SignalApiCalendarEvent[]>();
      for (const r of relevant) {
        const d = earningsRowDate(r);
        if (d.length < 10) continue;
        const arr = byYmd.get(d) ?? [];
        arr.push(r);
        byYmd.set(d, arr);
      }
      for (const [ymd, rows] of byYmd) {
        const when = localDayTrigger(ymd, 7, 30);
        if (!when || when.getTime() <= Date.now()) continue;
        const syms = [...new Set(rows.map((r) => earningsRowSymbol(r)))].slice(0, 12);
        if (syms.length === 0) continue;
        const title =
          syms.length === 1
            ? `${syms[0]} earnings`
            : `Earnings · ${syms.slice(0, 3).join(', ')}${syms.length > 3 ? '…' : ''}`;
        const body = rows
          .slice(0, 8)
          .map(
            (r) =>
              `• ${earningsRowSymbol(r)} FY${earningsRowYear(r)} Q${earningsRowQuarter(r)} · ${earningsRowHour(r)}`,
          )
          .join('\n')
          .slice(0, 380);
        items.push({ id: `earn-day-${ymd}`, when, title, body });
      }
    } catch {
      /* ignore */
    }
  }

  items.sort((a, b) => a.when.getTime() - b.when.getTime());
  const slice = items.slice(0, 24);
  for (const it of slice) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: safeNotifyId(it.id),
        content: {
          title: it.title,
          body: it.body,
          data: { kind: DATA_KIND, id: it.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: it.when,
        },
      });
    } catch {
      /* 과거 트리거 등 */
    }
  }
}
