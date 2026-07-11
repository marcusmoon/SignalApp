/** expo-router `useLocalSearchParams` 값에서 첫 문자열을 꺼낸다. */
export function firstRouteParam(value: string | string[] | undefined): string {
  return String(Array.isArray(value) ? value[0] : value || '').trim();
}
