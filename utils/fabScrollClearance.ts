/** FAB 스택이 스크롤 base 위로 겹치는 높이만 clearance로 계산 (순수). */

export function fabScrollClearanceAboveBase(
  fabCount: number,
  base: number,
  opts?: { fabSize?: number; fabGap?: number; offset?: number },
): number {
  const count = Math.max(0, Math.floor(fabCount));
  if (count <= 0) return 0;
  const fabSize = opts?.fabSize ?? 56;
  const fabGap = opts?.fabGap ?? 12;
  const offset = opts?.offset ?? 8;
  const stackHeight = offset + count * fabSize + Math.max(0, count - 1) * fabGap;
  return Math.max(0, stackHeight - Math.max(0, base));
}
