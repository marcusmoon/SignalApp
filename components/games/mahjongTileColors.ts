import type { AppTheme } from '@/constants/theme';
import { tileSuitColor } from '@/domain/games/mahjongSolitaire';

export type MahjongTileTint = { bg: string; border: string; text: string };

/** 마작 타일 색 — 라이트·다크 모두 보드 대비 확보 */
export function mahjongTileTint(theme: AppTheme, kind: string): MahjongTileTint {
  const suit = tileSuitColor(kind);
  const dark = theme.colorScheme === 'dark';

  if (dark) {
    switch (suit) {
      case 'dot':
        return { bg: theme.bgElevated, border: theme.green, text: theme.green };
      case 'bamboo':
        return { bg: theme.bgElevated, border: theme.warning, text: theme.warning };
      case 'char':
        return { bg: theme.bgElevated, border: theme.danger, text: theme.danger };
      case 'flower':
        return { bg: theme.bgElevated, border: theme.textMuted, text: theme.text };
      default:
        return { bg: theme.bgElevated, border: theme.border, text: theme.text };
    }
  }

  switch (suit) {
    case 'dot':
      return { bg: theme.greenDim, border: theme.greenBorder, text: theme.green };
    case 'bamboo':
      return { bg: theme.warningDim, border: theme.warning, text: theme.warning };
    case 'char':
      return { bg: theme.dangerDim, border: theme.danger, text: theme.danger };
    case 'flower':
      return { bg: theme.bgElevated, border: theme.border, text: theme.text };
    default:
      return { bg: theme.card, border: theme.border, text: theme.text };
  }
}
