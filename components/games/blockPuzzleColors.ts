import type { AppTheme } from '@/constants/theme';

export type BlockPieceTint = {
  bg: string;
  border: string;
  shine: string;
};

/** 블록 퍼즐 조각 색 — 라이트·다크 모두 보드 대비 확보 */
export function blockPieceTint(theme: AppTheme, id: number): BlockPieceTint {
  const dark = theme.colorScheme === 'dark';

  if (dark) {
    const borderById: Record<number, string> = {
      1: theme.green,
      2: theme.warning,
      3: theme.danger,
      4: theme.greenBorder,
      5: theme.danger,
      6: theme.text,
      7: theme.warning,
    };
    const border = borderById[id] ?? theme.green;
    return { bg: theme.card, border, shine: border };
  }

  switch (id) {
    case 1:
      return { bg: theme.greenDim, border: theme.green, shine: theme.green };
    case 2:
      return { bg: theme.warningDim, border: theme.warning, shine: theme.warning };
    case 3:
      return { bg: theme.card, border: theme.danger, shine: theme.danger };
    case 4:
      return { bg: theme.greenDim, border: theme.greenBorder, shine: theme.green };
    case 5:
      return { bg: theme.dangerDim, border: theme.danger, shine: theme.danger };
    case 6:
      return { bg: theme.card, border: theme.green, shine: theme.green };
    case 7:
      return { bg: theme.warningDim, border: theme.warning, shine: theme.warning };
    default:
      return { bg: theme.card, border: theme.border, shine: theme.textMuted };
  }
}
