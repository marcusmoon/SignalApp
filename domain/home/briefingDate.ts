export function briefingRowYmd(row: { briefingDate?: string | null } | null | undefined): string {
  return String(row?.briefingDate || '').slice(0, 10);
}

export function matchesBriefingYmd(
  row: { briefingDate?: string | null } | null | undefined,
  ymd: string,
): boolean {
  const date = briefingRowYmd(row);
  return Boolean(ymd && date && date === ymd);
}

export function briefingsForYmd<T extends { briefingDate?: string | null }>(
  rows: readonly T[],
  ymd: string,
): T[] {
  return rows.filter((row) => matchesBriefingYmd(row, ymd));
}
