/**
 * SIGNAL: 다크 모드 기본 (PRD UX 정책)
 * Native `useColorScheme` 과 동일 — web `system` 모드도 OS 가 아니라 앱 기본(다크)을 따른다.
 */
export function useColorScheme(): 'dark' {
  return 'dark';
}
