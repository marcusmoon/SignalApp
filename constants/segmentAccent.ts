import type { NewsSegmentKey } from '@/constants/newsSegment';
import type { SourceAccent } from '@/constants/sourceAccent';
import { accentAlpha } from '@/constants/sourceAccent';
import type { AppTheme } from '@/constants/theme';
import type { QuoteSegmentKey } from '@/domain/quotes/constants';

export type { QuoteSegmentKey };

export function newsSegmentAccent(key: NewsSegmentKey, theme: AppTheme): SourceAccent {
  switch (key) {
    case 'all':
      return {
        glyph: '◈',
        accent: theme.green,
        dim: theme.greenDim,
        border: theme.greenBorder,
      };
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
    case 'it':
      return {
        glyph: '⌘',
        accent: '#0D9488',
        dim: accentAlpha('#0D9488', theme.colorScheme === 'dark' ? 0.22 : 0.12),
        border: accentAlpha('#0D9488', theme.colorScheme === 'dark' ? 0.45 : 0.28),
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

export function marketBriefingAccent(market: string, theme: AppTheme): SourceAccent {
  const key = String(market || '').trim().toLowerCase();
  if (key === 'kr') return newsSegmentAccent('korea', theme);
  if (key === 'us') return newsSegmentAccent('global', theme);
  return newsSegmentAccent('global', theme);
}

export function quoteSegmentAccent(key: QuoteSegmentKey, theme: AppTheme): SourceAccent {
  switch (key) {
    case 'etf':
      return {
        glyph: '▣',
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
