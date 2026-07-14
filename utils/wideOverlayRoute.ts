import type { IpadContentPane } from '@/contexts/IpadSidebarNavContext';

/** Wide web/iPad — `/(tabs)/home` 쿼리 `overlay` 값 */
export type WideOverlayKind =
  | 'news-issues'
  | 'disclosure-flow'
  | 'today-briefing'
  | 'calendar'
  | 'account'
  | 'settings'
  | 'alerts'
  | 'terms-history';

export const WIDE_HOME_ROUTE = '/(tabs)/home';

export function normalizePathname(pathname: string): string {
  return (pathname.split('?')[0] ?? '').replace(/\/$/, '') || '/';
}

export function isWideHomePath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return path === '/' || path === '/home' || path.endsWith('/home');
}

export function legacyPathnameToOverlayKind(pathname: string): WideOverlayKind | null {
  const path = normalizePathname(pathname);
  if (path.startsWith('/news-issues')) return 'news-issues';
  if (path.startsWith('/disclosure-flow')) return 'disclosure-flow';
  if (path.startsWith('/today-briefing')) return 'today-briefing';
  if (path.startsWith('/calendar')) return 'calendar';
  if (path.startsWith('/account')) return 'account';
  if (path.startsWith('/settings')) return 'settings';
  if (path.startsWith('/alerts')) return 'alerts';
  if (path.startsWith('/terms-history')) return 'terms-history';
  return null;
}

export function overlayKindToContentPane(kind: WideOverlayKind): IpadContentPane {
  switch (kind) {
    case 'news-issues':
      return 'newsIssues';
    case 'disclosure-flow':
      return 'disclosureFlow';
    case 'today-briefing':
      return 'todayBriefing';
    case 'calendar':
      return 'calendar';
    case 'account':
      return 'account';
    case 'settings':
      return 'settings';
    case 'alerts':
      return 'alerts';
    case 'terms-history':
      return 'termsHistory';
    default:
      return 'home';
  }
}

export function isWideOverlayKind(value: string | undefined): value is WideOverlayKind {
  return (
    value === 'news-issues' ||
    value === 'disclosure-flow' ||
    value === 'today-briefing' ||
    value === 'calendar' ||
    value === 'account' ||
    value === 'settings' ||
    value === 'alerts' ||
    value === 'terms-history'
  );
}

export function overlayParamsFromRecord(
  params: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key === 'overlay') continue;
    const raw = Array.isArray(value) ? value[0] : value;
    const text = String(raw ?? '').trim();
    if (text) out[key] = text;
  }
  return out;
}
