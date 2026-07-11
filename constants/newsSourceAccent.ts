import type { AppTheme } from '@/constants/theme';
import { accentAlpha, fallbackSourceAccent, type SourceAccent } from '@/constants/sourceAccent';
import { resolveSourceIconUrl } from '@/services/sourceIcon';

function normalizeSourceName(sourceName: string): string {
  return sourceName.trim().toLowerCase();
}

type Rule = {
  test: (normalized: string) => boolean;
  glyph: string;
  accent: string;
  domain?: string;
};

function newsSourceRules(theme: AppTheme): Rule[] {
  return [
    { test: (n) => n.includes('매일경제') || n.includes('maekyung') || n === 'mk', glyph: '매', accent: '#D93B3B', domain: 'mk.co.kr' },
    { test: (n) => n.includes('한국경제') || n.includes('hankyung') || n.includes('한경'), glyph: '한', accent: '#00A651', domain: 'hankyung.com' },
    { test: (n) => n.includes('financial juice'), glyph: 'FJ', accent: '#7C3AED', domain: 'financialjuice.com' },
    { test: (n) => n.includes('globenewswire'), glyph: 'GW', accent: '#0891B2', domain: 'globenewswire.com' },
    { test: (n) => n.includes('pr newswire'), glyph: 'PR', accent: '#2563EB', domain: 'prnewswire.com' },
    { test: (n) => n.includes('reuters'), glyph: 'R', accent: '#FF8000', domain: 'reuters.com' },
    { test: (n) => n.includes('bloomberg'), glyph: 'B', accent: theme.accentOrange, domain: 'bloomberg.com' },
    { test: (n) => n.includes('yahoo'), glyph: 'Y', accent: '#6001D2', domain: 'finance.yahoo.com' },
    { test: (n) => n.includes('coindesk'), glyph: 'CD', accent: '#2563EB', domain: 'coindesk.com' },
    { test: (n) => n.includes('finnhub'), glyph: 'FH', accent: theme.green, domain: 'finnhub.com' },
    { test: (n) => n.includes('sec') || n.includes('edgar'), glyph: 'SEC', accent: '#4B5563', domain: 'sec.gov' },
    { test: (n) => n.includes('dart'), glyph: 'D', accent: '#1D4ED8', domain: 'dart.fss.or.kr' },
    { test: (n) => n.includes('연합'), glyph: '연', accent: '#0EA5E9', domain: 'yna.co.kr' },
    { test: (n) => n.includes('조선'), glyph: '조', accent: '#DC2626', domain: 'chosun.com' },
    { test: (n) => n.includes('한겨레'), glyph: '겨', accent: '#16A34A', domain: 'hani.co.kr' },
  ];
}

function ruleToAccent(
  rule: Rule,
  theme: AppTheme,
  sourceName: string,
  sourceUrl?: string | null,
): SourceAccent {
  return {
    accent: rule.accent,
    dim: accentAlpha(rule.accent, theme.colorScheme === 'dark' ? 0.22 : 0.12),
    border: accentAlpha(rule.accent, theme.colorScheme === 'dark' ? 0.45 : 0.28),
    glyph: rule.glyph,
    iconUrl: resolveSourceIconUrl(sourceName, sourceUrl, rule.domain),
  };
}

/** 뉴스 기사 `sourceName` → 색상·파비콘·이니셜 배지 */
export function newsSourceAccent(
  sourceName: string,
  theme: AppTheme,
  sourceUrl?: string | null,
): SourceAccent {
  const normalized = normalizeSourceName(sourceName);
  if (!normalized || normalized === '—') {
    return {
      ...fallbackSourceAccent('news', theme),
      iconUrl: resolveSourceIconUrl('news', sourceUrl),
    };
  }
  const rule = newsSourceRules(theme).find((entry) => entry.test(normalized));
  if (rule) return ruleToAccent(rule, theme, sourceName, sourceUrl);
  return {
    ...fallbackSourceAccent(sourceName, theme),
    iconUrl: resolveSourceIconUrl(sourceName, sourceUrl),
  };
}
