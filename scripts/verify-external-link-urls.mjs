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

function yahooFinanceIosAppLaunchUrls(webUrl) {
  const urls = [];
  try {
    const parsed = new URL(webUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'finance.yahoo.com') {
      const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      if (path.length > 1) {
        const trimmed = path.replace(/^\//, '');
        urls.push(`yfinance:/${trimmed}`);
        urls.push(`yfinance://${parsed.host}${path}`);
        urls.push(`yahoo:/${trimmed}`);
        urls.push(`yahoo://${parsed.host}${path}`);
      }
    }
  } catch {
    /* ignore */
  }
  urls.push('yfinance://', 'yahoo://');
  return urls;
}

function naverFinanceInAppBrowserScheme(webUrl) {
  const encoded = encodeURIComponent(webUrl);
  return `naversearchapp://inappbrowser?url=${encoded}&target=new&version=6`;
}

const yahooHome = yahooFinanceIosAppLaunchUrls('https://finance.yahoo.com');
assert(yahooHome.length === 2, 'Yahoo home should only use base schemes');
assert(yahooHome.includes('yfinance://'), 'Yahoo home includes yfinance://');
assert(!yahooHome.some((u) => u.startsWith('https://')), 'Yahoo iOS launch must not include https');

const yahooQuote = yahooFinanceIosAppLaunchUrls('https://finance.yahoo.com/quote/AAPL');
assert(yahooQuote[0] === 'yfinance:/quote/AAPL', 'Yahoo quote path scheme');
assert(yahooQuote.includes('yfinance://'), 'Yahoo quote includes app home fallback');
assert(!yahooQuote.some((u) => u.startsWith('https://')), 'Yahoo quote launch must not include https');

const naverStock = naverFinanceInAppBrowserScheme(
  'https://m.stock.naver.com/domestic/stock/005930/total',
);
assert(naverStock.startsWith('naversearchapp://inappbrowser?'), 'Naver inappbrowser scheme');
assert(naverStock.includes(encodeURIComponent('https://m.stock.naver.com')), 'Naver encodes target URL');

console.log('OK: external link URL builders');
console.log('  yahoo home:', yahooHome.join(' | '));
console.log('  yahoo quote:', yahooQuote.slice(0, 3).join(' | '), '...');
console.log('  naver:', naverStock.slice(0, 72), '...');
