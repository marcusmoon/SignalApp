/**
 * iPhone More 허브 → 보드·공시·유튜브 진입 출처.
 * URL `from=`을 쓰지 않는다 (wide drillFrom과 동일 — 공유 불가 세션 상태).
 */
import { useSyncExternalStore } from 'react';

export type PhoneMoreEntryRoute = 'board' | 'disclosures' | 'youtube';

type Listener = () => void;

let entry: PhoneMoreEntryRoute | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

export function subscribePhoneMoreEntry(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPhoneMoreEntry(): PhoneMoreEntryRoute | null {
  return entry;
}

/** More 허브에서 자식 화면으로 들어갈 때 */
export function markPhoneEnteredFromMore(route: PhoneMoreEntryRoute): void {
  if (entry === route) return;
  entry = route;
  notify();
}

/** More 외 진입·뒤로 복귀 시 */
export function clearPhoneMoreEntry(): void {
  if (entry == null) return;
  entry = null;
  notify();
}

export function usePhoneEnteredFromMore(route: PhoneMoreEntryRoute): boolean {
  return useSyncExternalStore(
    subscribePhoneMoreEntry,
    () => getPhoneMoreEntry() === route,
    () => false,
  );
}
