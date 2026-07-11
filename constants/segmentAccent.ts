import type { NewsSegmentKey } from '@/constants/newsSegment';
import type { SourceAccent } from '@/constants/sourceAccent';
import { accentAlpha } from '@/constants/sourceAccent';
import type { AppTheme } from '@/constants/theme';

export type QuoteSegmentKey = 'watch' | 'popular' | 'mcap' | 'coin';

export function newsSegmentAccent(key: NewsSegmentKey, theme: AppTheme): SourceAccent {
  switch (key) {
    case 'korea':
      return {
        glyph: '🇰🇷',
        accent: '#E5484D',
        dim: accentAlpha('#E5484D', theme.colorScheme === 'dark' ? 0.22 : 0.12),
        border: accentAlpha('#E5484D', theme.colorScheme === 'dark' ? 0.45 : 0.28),
      };
    case 'crypto':
      return {
        glyph: '₿',
        accent: '#F59F00',
        dim: accentAlpha('#F59F00', theme.colorScheme === 'dark' ? 0.22 : 0.14),
        border: accentAlpha('#F59F00', theme.colorScheme === 'dark' ? 0.45 : 0.3),
      };
    case 'watch':
      return {
        glyph: '★',
        accent: theme.accentOrange,
        dim: theme.warningDim,
        border: accentAlpha(theme.accentOrange, theme.colorScheme === 'dark' ? 0.5 : 0.35),
      };
    case 'video':
      return {
        glyph: '▶',
        accent: '#7C3AED',
        dim: accentAlpha('#7C3AED', theme.colorScheme === 'dark' ? 0.22 : 0.12),
        border: accentAlpha('#7C3AED', theme.colorScheme === 'dark' ? 0.45 : 0.28),
      };
    case 'global':
    default:
      return {
        glyph: '🇺🇸',
        accent: '#2563EB',
        dim: accentAlpha('#2563EB', theme.colorScheme === 'dark' ? 0.22 : 0.12),
        border: accentAlpha('#2563EB', theme.colorScheme === 'dark' ? 0.45 : 0.28),
      };
  }
}

export function quoteSegmentAccent(key: QuoteSegmentKey, theme: AppTheme): SourceAccent {
  switch (key) {
    case 'popular':
      return {
        glyph: '🔥',
        accent: '#F97316',
        dim: accentAlpha('#F97316', theme.colorScheme === 'dark' ? 0.22 : 0.12),
        border: accentAlpha('#F97316', theme.colorScheme === 'dark' ? 0.45 : 0.28),
      };
    case 'mcap':
      return {
        glyph: '◎',
        accent: '#0EA5E9',
        dim: accentAlpha('#0EA5E9', theme.colorScheme === 'dark' ? 0.22 : 0.12),
        border: accentAlpha('#0EA5E9', theme.colorScheme === 'dark' ? 0.45 : 0.28),
      };
    case 'coin':
      return {
        glyph: '₿',
        accent: '#F59F00',
        dim: accentAlpha('#F59F00', theme.colorScheme === 'dark' ? 0.22 : 0.14),
        border: accentAlpha('#F59F00', theme.colorScheme === 'dark' ? 0.45 : 0.3),
      };
    case 'watch':
    default:
      return {
        glyph: '★',
        accent: theme.green,
        dim: theme.greenDim,
        border: theme.greenBorder,
      };
  }
}
