import type { IpadContentPane } from '@/contexts/IpadSidebarNavContext';

const TAB_ROUTE_PREFIXES = [
  '/news',
  '/signal',
  '/quotes',
  '/disclosures',
  '/youtube',
  '/board',
  '/more',
] as const;

/** My info 허브에서 여는 스택 — 사이드바는 내 정보 활성으로 표시 */
const ACCOUNT_AUX_PREFIXES = ['/alerts', '/calendar', '/terms', '/terms-history'] as const;

const STACK_OVER_TAB_PREFIXES = ['/symbol/', '/disclosures/', '/community/'] as const;

/** Wide web/iPad: URL → sidebar overlay pane. Refresh 시 현재 경로를 복원한다. */
export function resolveIpadContentPaneFromPathname(pathname: string): IpadContentPane {
  const path = (pathname.split('?')[0] ?? '').replace(/\/$/, '') || '/';

  if (path === '/' || path === '/home') return 'home';
  if (path.startsWith('/account')) return 'account';
  if (path.startsWith('/settings')) return 'settings';
  if (ACCOUNT_AUX_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return 'account';
  }
  if (path.startsWith('/news-issues')) return 'newsIssues';
  if (path.startsWith('/disclosure-flow')) return 'disclosureFlow';

  if (TAB_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return 'tabs';
  }
  if (STACK_OVER_TAB_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return 'tabs';
  }

  return 'tabs';
}
