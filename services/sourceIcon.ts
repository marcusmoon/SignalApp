const failedIconUrls = new Set<string>();

export function markSourceIconFailed(url: string): void {
  failedIconUrls.add(url);
}

export function isSourceIconFailed(url: string): boolean {
  return failedIconUrls.has(url);
}

export function domainFromUrl(url: string | null | undefined): string | null {
  const raw = String(url || '').trim();
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname.trim().toLowerCase();
    if (!host) return null;
    return host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function sourceFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

function guessSourceDomain(sourceName: string): string | null {
  const normalized = sourceName.trim().toLowerCase();
  if (!normalized || normalized === '—') return null;

  const rules: { test: (n: string) => boolean; domain: string }[] = [
    { test: (n) => n.includes('매일경제') || n.includes('maekyung') || n === 'mk', domain: 'mk.co.kr' },
    { test: (n) => n.includes('한국경제') || n.includes('hankyung') || n.includes('한경'), domain: 'hankyung.com' },
    { test: (n) => n.includes('financial juice'), domain: 'financialjuice.com' },
    { test: (n) => n.includes('globenewswire'), domain: 'globenewswire.com' },
    { test: (n) => n.includes('pr newswire'), domain: 'prnewswire.com' },
    { test: (n) => n.includes('reuters'), domain: 'reuters.com' },
    { test: (n) => n.includes('bloomberg'), domain: 'bloomberg.com' },
    { test: (n) => n.includes('yahoo'), domain: 'finance.yahoo.com' },
    { test: (n) => n.includes('coindesk'), domain: 'coindesk.com' },
    { test: (n) => n.includes('finnhub'), domain: 'finnhub.com' },
    { test: (n) => n.includes('연합'), domain: 'yna.co.kr' },
    { test: (n) => n.includes('조선'), domain: 'chosun.com' },
    { test: (n) => n.includes('한겨레'), domain: 'hani.co.kr' },
    { test: (n) => n.includes('sec') || n.includes('edgar'), domain: 'sec.gov' },
    { test: (n) => n.includes('dart'), domain: 'dart.fss.or.kr' },
  ];

  const hit = rules.find((rule) => rule.test(normalized));
  return hit?.domain ?? null;
}

export function resolveSourceIconUrl(
  sourceName: string,
  sourceUrl?: string | null,
  mappedDomain?: string | null,
): string | null {
  const domain = mappedDomain || domainFromUrl(sourceUrl) || guessSourceDomain(sourceName);
  if (!domain) return null;
  const url = sourceFaviconUrl(domain);
  if (isSourceIconFailed(url)) return null;
  return url;
}
