import type { IpadContentPane } from '@/contexts/IpadSidebarNavContext';

/** Wide web/iPad — `/(tabs)/home` 쿼리 `overlay` 값 */
export type WideOverlayKind =
  | 'news-issues'
  | 'disclosure-flow'
  | 'today-briefing'
  | 'market-briefing'
  | 'etf-insights'
  | 'etf-insight'
  | 'calendar'
  | 'account'
  | 'settings'
  | 'alerts'
  | 'terms-history'
  | 'terms'
  | 'board'
  | 'community'
  | 'symbol';

export const WIDE_HOME_ROUTE = '/(tabs)/home';

export const WIDE_OVERLAY_CLEAR_PARAMS: Record<string, undefined> = {
  overlay: undefined,
  category: undefined,
  date: undefined,
  digestId: undefined,
  market: undefined,
  tab: undefined,
  from: undefined,
  pane: undefined,
  type: undefined,
  sort: undefined,
  source: undefined,
  id: undefined,
  ticker: undefined,
  session: undefined,
};

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
  if (path.startsWith('/market-briefing')) return 'market-briefing';
  if (path.startsWith('/etf-insights')) return 'etf-insights';
  if (path.startsWith('/etf-insight')) return 'etf-insight';
  if (path.startsWith('/calendar')) return 'calendar';
  if (path.startsWith('/account')) return 'account';
  if (path.startsWith('/settings')) return 'settings';
  if (path.startsWith('/alerts')) return 'alerts';
  if (path.startsWith('/terms-history')) return 'terms-history';
  if (path.startsWith('/terms')) return 'terms';
  if (path.startsWith('/community/')) return 'community';
  if (path.startsWith('/symbol/')) return 'symbol';
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
    case 'market-briefing':
      return 'marketBriefing';
    case 'etf-insights':
      return 'etfInsights';
    case 'etf-insight':
      return 'etfInsight';
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
    case 'terms':
      return 'terms';
    case 'board':
      return 'board';
    case 'community':
      return 'community';
    case 'symbol':
      return 'symbol';
    default:
      return 'home';
  }
}

export function isWideOverlayKind(value: string | undefined): value is WideOverlayKind {
  return (
    value === 'news-issues' ||
    value === 'disclosure-flow' ||
    value === 'today-briefing' ||
    value === 'market-briefing' ||
    value === 'etf-insights' ||
    value === 'etf-insight' ||
    value === 'calendar' ||
    value === 'account' ||
    value === 'settings' ||
    value === 'alerts' ||
    value === 'terms-history' ||
    value === 'terms' ||
    value === 'board' ||
    value === 'community' ||
    value === 'symbol'
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

/** Extract community post id from `/community/:id` path. */
export function communityIdFromPathname(pathname: string): string | undefined {
  const path = normalizePathname(pathname);
  const match = path.match(/\/community\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

/** Extract ticker from `/symbol/:ticker` path. */
export function symbolTickerFromPathname(pathname: string): string | undefined {
  const path = normalizePathname(pathname);
  const match = path.match(/\/symbol\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]).toUpperCase() : undefined;
}
