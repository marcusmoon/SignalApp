/**
 * 외부 링크 launch URL 빌더 스모크 테스트 (Node에서 순수 함수 검증).
 * 실행: node scripts/verify-external-link-urls.mjs
 */

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    process.exit(1);
  }
}

function orderYahooIosLaunchUrls(urls) {
  const hostQualified = [];
  const pathShort = [];
  const bare = [];
  for (const url of urls) {
    if (url === 'yfinance://' || url === 'yahoo://') {
      bare.push(url);
      continue;
    }
    if (/^[a-z]+:\/\/finance\.yahoo\.com/i.test(url)) {
      hostQualified.push(url);
      continue;
    }
    if (url.includes('?')) continue;
    pathShort.push(url);
  }
  return [...hostQualified, ...pathShort, ...bare];
}

function yahooFinanceIosAppLaunchUrls(webUrl) {
  const urls = [];
  try {
    const parsed = new URL(webUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'finance.yahoo.com') {
      const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      const trimmed = path.replace(/^\//, '');
      if (trimmed.length > 0) {
        urls.push(`yfinance:/${trimmed}`);
        urls.push(`yfinance://${parsed.host}${path}`);
        urls.push(`yahoo:/${trimmed}`);
        urls.push(`yahoo://${parsed.host}${path}`);
      } else {
        urls.push(`yfinance://${parsed.host}/`);
        urls.push(`yfinance://${parsed.host}`);
        urls.push(`yahoo://${parsed.host}/`);
        urls.push(`yahoo://${parsed.host}`);
      }
    }
  } catch {
    /* ignore */
  }
  urls.push('yfinance://', 'yahoo://');
  return orderYahooIosLaunchUrls(urls);
}

function naverFinanceInAppBrowserScheme(webUrl) {
  const encoded = encodeURIComponent(webUrl);
  return `naversearchapp://inappbrowser?url=${encoded}&target=new&version=6`;
}

const yahooHome = yahooFinanceIosAppLaunchUrls('https://finance.yahoo.com');
assert(yahooHome.length === 6, 'Yahoo home should use host schemes plus base fallbacks');
assert(yahooHome[0] === 'yfinance://finance.yahoo.com/', 'Yahoo home host scheme');
assert(yahooHome.includes('yfinance://'), 'Yahoo home includes yfinance://');
assert(!yahooHome.some((u) => u.startsWith('https://')), 'Yahoo iOS launch must not include https');

const yahooQuote = yahooFinanceIosAppLaunchUrls('https://finance.yahoo.com/quote/AAPL');
assert(yahooQuote[0] === 'yfinance://finance.yahoo.com/quote/AAPL', 'Yahoo quote host scheme first');
assert(yahooQuote.includes('yfinance:/quote/AAPL'), 'Yahoo quote path scheme');
assert(yahooQuote.includes('yfinance://'), 'Yahoo quote includes app home fallback');
assert(!yahooQuote.some((u) => u.startsWith('https://')), 'Yahoo iOS launch must not include https');

const yahooEarnings = yahooFinanceIosAppLaunchUrls(
  'https://finance.yahoo.com/calendar/earnings?symbol=NVDA',
);
assert(
  yahooEarnings[0] === 'yfinance://finance.yahoo.com/calendar/earnings?symbol=NVDA',
  'Yahoo earnings host scheme first',
);
assert(
  !yahooEarnings.includes('yfinance:/calendar/earnings?symbol=NVDA'),
  'Yahoo earnings skips ambiguous short scheme with query',
);

const yahooWebSafariHome = (() => {
  for (const url of yahooFinanceIosAppLaunchUrls('https://finance.yahoo.com')) {
    if (/^yfinance:\/\/finance\.yahoo\.com/i.test(url)) return url;
  }
  return null;
})();
assert(yahooWebSafariHome === 'yfinance://finance.yahoo.com/', 'Yahoo Safari web uses host scheme only');

const naverStock = naverFinanceInAppBrowserScheme(
  'https://m.stock.naver.com/domestic/stock/005930/total',
);
assert(naverStock.startsWith('naversearchapp://inappbrowser?'), 'Naver inappbrowser scheme');
assert(naverStock.includes(encodeURIComponent('https://m.stock.naver.com')), 'Naver encodes target URL');

/** Registry host 매칭 — `externalLinkRegistry.ts`와 동일 규칙 */
const REGISTRY_HOSTS = {
  'finance.yahoo.com': 'yahoo',
  'm.stock.naver.com': 'naver',
  'm.cafe.naver.com': 'naver',
  'tossinvest.com': 'toss',
  'upbit.com': 'upbit',
  'binance.com': 'binance',
};

function registryHostFor(webUrl) {
  try {
    const host = new URL(webUrl).hostname.toLowerCase().replace(/^www\./, '');
    return REGISTRY_HOSTS[host] ?? null;
  } catch {
    return null;
  }
}

assert(registryHostFor('https://finance.yahoo.com/quote/NVDA') === 'yahoo', 'Registry host: Yahoo');
assert(
  registryHostFor('https://finance.yahoo.com/calendar/earnings?symbol=NVDA') === 'yahoo',
  'Registry host: Yahoo earnings',
);
assert(
  registryHostFor('https://m.stock.naver.com/domestic/stock/005930/total') === 'naver',
  'Registry host: Naver stock',
);
assert(registryHostFor('https://www.tossinvest.com/stocks/AAPL/order') === 'toss', 'Registry host: Toss');
assert(registryHostFor('https://upbit.com') === 'upbit', 'Registry host: Upbit');
assert(registryHostFor('https://www.google.com/finance') === null, 'Registry host: no app link');

console.log('OK: external link URL builders');
console.log('  yahoo home:', yahooHome.join(' | '));
console.log('  yahoo quote:', yahooQuote.slice(0, 3).join(' | '), '...');
console.log('  naver:', naverStock.slice(0, 72), '...');
