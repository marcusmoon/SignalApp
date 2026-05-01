import type { SignalApiCalendarEvent } from '@/integrations/signal-api/types';

export function earningsRowDate(ev: SignalApiCalendarEvent): string {
  const d = String(ev.date || '').trim();
  return d.length >= 10 ? d.slice(0, 10) : '';
}

export function earningsRowSymbol(ev: SignalApiCalendarEvent): string {
  return String(ev.symbol || '').trim().toUpperCase();
}

export function earningsRowYear(ev: SignalApiCalendarEvent): number {
  if (typeof ev.fiscalYear === 'number' && Number.isFinite(ev.fiscalYear)) return ev.fiscalYear;
  const d = earningsRowDate(ev);
  if (d.length >= 4) {
    const y = Number(d.slice(0, 4));
    if (Number.isFinite(y)) return y;
  }
  return new Date().getFullYear();
}

export function earningsRowQuarter(ev: SignalApiCalendarEvent): number {
  if (typeof ev.fiscalQuarter === 'number' && Number.isFinite(ev.fiscalQuarter)) return ev.fiscalQuarter;
  return 1;
}

export function earningsRowHour(ev: SignalApiCalendarEvent): string {
  return String(ev.earningsHour || ev.timeLabel || '').trim();
}
