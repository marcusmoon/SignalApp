/**
 * 홈 바로가기 타일 `상위·하위` 결합 — 로케일/아이콘 의존 없는 순수 규칙.
 * 상세는 DESIGN-GUIDE 홈 바로가기 타일 라벨.
 */

/** 상위·하위 결합. 길면 하위만. */
export function homeShortcutCompoundLabel(parent: string, child: string): string {
  const p = parent.trim();
  const c = child.trim();
  if (!c) return p;
  if (!p) return c;
  const joined = `${p}·${c}`;
  const budget = /[A-Za-z]/.test(joined) ? 12 : 8;
  return joined.length <= budget ? joined : c;
}
