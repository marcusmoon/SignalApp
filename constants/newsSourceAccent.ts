import type { AppTheme } from '@/constants/theme';
import { accentAlpha, fallbackSourceAccent, type SourceAccent } from '@/constants/sourceAccent';

function normalizeSourceName(sourceName: string): string {
  return sourceName.trim().toLowerCase();
}

type Rule = {
  test: (normalized: string) => boolean;
  glyph: string;
  accent: string;
};

function newsSourceRules(theme: AppTheme): Rule[] {
  return [
    { test: (n) => n.includes('매일경제') || n.includes('maekyung') || n === 'mk', glyph: '매', accent: '#D93B3B' },
    { test: (n) => n.includes('한국경제') || n.includes('hankyung') || n.includes('한경'), glyph: '한', accent: '#00A651' },
    { test: (n) => n.includes('financial juice'), glyph: 'FJ', accent: '#7C3AED' },
    { test: (n) => n.includes('globenewswire'), glyph: 'GW', accent: '#0891B2' },
    { test: (n) => n.includes('pr newswire'), glyph: 'PR', accent: '#2563EB' },
    { test: (n) => n.includes('reuters'), glyph: 'R', accent: '#FF8000' },
    { test: (n) => n.includes('bloomberg'), glyph: 'B', accent: theme.accentOrange },
    { test: (n) => n.includes('yahoo'), glyph: 'Y', accent: '#6001D2' },
    { test: (n) => n.includes('coindesk'), glyph: 'CD', accent: '#2563EB' },
    { test: (n) => n.includes('finnhub'), glyph: 'FH', accent: theme.green },
    { test: (n) => n.includes('sec') || n.includes('edgar'), glyph: 'SEC', accent: '#4B5563' },
    { test: (n) => n.includes('dart'), glyph: 'D', accent: '#1D4ED8' },
    { test: (n) => n.includes('연합'), glyph: '연', accent: '#0EA5E9' },
    { test: (n) => n.includes('조선'), glyph: '조', accent: '#DC2626' },
    { test: (n) => n.includes('한겨레'), glyph: '겨', accent: '#16A34A' },
  ];
}

function ruleToAccent(rule: Rule, theme: AppTheme): SourceAccent {
  return {
    accent: rule.accent,
    dim: accentAlpha(rule.accent, theme.colorScheme === 'dark' ? 0.22 : 0.12),
    border: accentAlpha(rule.accent, theme.colorScheme === 'dark' ? 0.45 : 0.28),
    glyph: rule.glyph,
  };
}

/** 뉴스 기사 `sourceName` → 색상·이니셜 배지 */
export function newsSourceAccent(sourceName: string, theme: AppTheme): SourceAccent {
  const normalized = normalizeSourceName(sourceName);
  if (!normalized || normalized === '—') {
    return fallbackSourceAccent('news', theme);
  }
  const rule = newsSourceRules(theme).find((entry) => entry.test(normalized));
  if (rule) return ruleToAccent(rule, theme);
  return fallbackSourceAccent(sourceName, theme);
}
