/**
 * More 허브 타일 순서 정규화 — ETF·게임센터 삽입 · 레거시 키 마이그레이션.
 */

export type MoreHubRouteKeyNormalized =
  | 'account'
  | 'disclosures'
  | 'etfBriefing'
  | 'gameCenter'
  | 'board';

export const MORE_HUB_ROUTE_ORDER_DEFAULT_NORMALIZED: MoreHubRouteKeyNormalized[] = [
  'account',
  'disclosures',
  'etfBriefing',
  'board',
  'gameCenter',
];

function migrateHubKey(raw: unknown): MoreHubRouteKeyNormalized | null {
  if (raw === 'todayBriefing') return 'disclosures';
  if (raw === 'settings' || raw === 'screener') return null;
  if (
    raw === 'account' ||
    raw === 'disclosures' ||
    raw === 'etfBriefing' ||
    raw === 'gameCenter' ||
    raw === 'board'
  ) {
    return raw;
  }
  return null;
}

/** 게임센터는 게시판 바로 뒤에 둔다 (이전에 앞에 있던 저장분도 이동). */
function ensureGameCenterAfterBoard(out: MoreHubRouteKeyNormalized[]): void {
  const gcIdx = out.indexOf('gameCenter');
  const boardIdx = out.indexOf('board');
  if (gcIdx < 0 || boardIdx < 0) return;
  if (gcIdx === boardIdx + 1) return;
  out.splice(gcIdx, 1);
  const nextBoardIdx = out.indexOf('board');
  out.splice(nextBoardIdx + 1, 0, 'gameCenter');
}

/** 빠진 키를 기본 순서 기준으로 끼워 넣는다. */
function insertMissingKey(
  out: MoreHubRouteKeyNormalized[],
  seen: Set<MoreHubRouteKeyNormalized>,
  key: MoreHubRouteKeyNormalized,
): void {
  if (seen.has(key)) return;
  if (key === 'etfBriefing') {
    const boardIdx = out.indexOf('board');
    if (boardIdx >= 0) out.splice(boardIdx, 0, key);
    else out.push(key);
    seen.add(key);
    return;
  }
  if (key === 'gameCenter') {
    const boardIdx = out.indexOf('board');
    if (boardIdx >= 0) out.splice(boardIdx + 1, 0, key);
    else out.push(key);
    seen.add(key);
    return;
  }
  out.push(key);
  seen.add(key);
}

export function normalizeMoreHubOrderRaw(raw: unknown): MoreHubRouteKeyNormalized[] {
  const defaults = MORE_HUB_ROUTE_ORDER_DEFAULT_NORMALIZED;
  if (!Array.isArray(raw)) return [...defaults];
  if (!raw.includes('account') && !raw.includes('todayBriefing')) return [...defaults];
  const out: MoreHubRouteKeyNormalized[] = [];
  const seen = new Set<MoreHubRouteKeyNormalized>();
  for (const x of raw) {
    const key = migrateHubKey(x);
    if (key && !seen.has(key)) {
      out.push(key);
      seen.add(key);
    }
  }
  for (const k of defaults) {
    insertMissingKey(out, seen, k);
  }
  ensureGameCenterAfterBoard(out);
  return out;
}
