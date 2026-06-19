import { config } from '../../config.mjs';

const COMPANY_TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json';
const SUBMISSIONS_URL = 'https://data.sec.gov/submissions/CIK{CIK}.json';
const DEFAULT_FORMS = ['8-K', '10-Q', '10-K', 'S-1', '6-K', '20-F'];
const TICKER_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

let tickerCache = null;
let tickerCacheAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function stableSymbol(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeCik(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.padStart(10, '0').slice(-10);
}

function secUserAgent() {
  const raw = String(config.secUserAgent || '').trim();
  if (raw) return raw;
  return 'SignalServer/0.1 contact=admin@example.com';
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': secUserAgent(),
      accept: 'application/json, text/plain;q=0.9, */*;q=0.1',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SEC_EDGAR_${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function parseAcceptanceDateTime(value, fallbackDate) {
  const raw = String(value || '').trim();
  const compact = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(raw);
  if (compact) {
    const [, year, month, day, hour, minute, second] = compact;
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`).toISOString();
  }
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  const date = String(fallbackDate || '').slice(0, 10);
  if (date) return new Date(`${date}T00:00:00.000Z`).toISOString();
  return new Date().toISOString();
}

function filingUrl(cik, accessionNumber) {
  const cikInt = String(Number(cik));
  const accession = String(accessionNumber || '').trim();
  const accessionNoDashes = accession.replace(/-/g, '');
  if (!cikInt || !accession || !accessionNoDashes) return '';
  return `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accessionNoDashes}/${accession}-index.html`;
}

function filingTitle({ symbol, companyName, form, primaryDocDescription }) {
  const label = String(primaryDocDescription || '').trim();
  const company = String(companyName || symbol || '').trim();
  if (label && label.toUpperCase() !== String(form || '').toUpperCase()) {
    return `${symbol} filed ${form}: ${label}`;
  }
  return `${symbol} filed ${form}${company && company !== symbol ? ` - ${company}` : ''}`;
}

function formSet(forms) {
  const source = Array.isArray(forms) && forms.length > 0 ? forms : DEFAULT_FORMS;
  return new Set(source.map((form) => String(form || '').trim().toUpperCase()).filter(Boolean));
}

async function tickerMap() {
  const now = Date.now();
  if (tickerCache && now - tickerCacheAt < TICKER_CACHE_TTL_MS) return tickerCache;
  const json = await fetchJson(COMPANY_TICKERS_URL);
  const map = new Map();
  for (const row of Object.values(json || {})) {
    if (!row || typeof row !== 'object') continue;
    const ticker = stableSymbol(row.ticker);
    const cik = normalizeCik(row.cik_str);
    if (!ticker || !cik) continue;
    map.set(ticker, {
      symbol: ticker,
      cik,
      companyName: String(row.title || '').trim(),
    });
  }
  tickerCache = map;
  tickerCacheAt = now;
  return map;
}

function recentRows(submissions) {
  const recent = submissions?.filings?.recent;
  if (!recent || typeof recent !== 'object') return [];
  const length = Math.max(
    ...['accessionNumber', 'filingDate', 'reportDate', 'acceptanceDateTime', 'form', 'primaryDocument', 'primaryDocDescription']
      .map((key) => (Array.isArray(recent[key]) ? recent[key].length : 0)),
    0,
  );
  const rows = [];
  for (let i = 0; i < length; i += 1) {
    rows.push({
      accessionNumber: recent.accessionNumber?.[i] || '',
      filingDate: recent.filingDate?.[i] || '',
      reportDate: recent.reportDate?.[i] || '',
      acceptanceDateTime: recent.acceptanceDateTime?.[i] || '',
      form: recent.form?.[i] || '',
      primaryDocument: recent.primaryDocument?.[i] || '',
      primaryDocDescription: recent.primaryDocDescription?.[i] || '',
    });
  }
  return rows;
}

function normalizeFiling({ symbol, cik, companyName, filing }) {
  const form = String(filing.form || '').trim().toUpperCase();
  const accessionNumber = String(filing.accessionNumber || '').trim();
  const sourceUrl = filingUrl(cik, accessionNumber);
  const filedAt = parseAcceptanceDateTime(filing.acceptanceDateTime, filing.filingDate);
  const summary = [
    companyName ? `${companyName} submitted SEC form ${form}.` : `${symbol} submitted SEC form ${form}.`,
    filing.reportDate ? `Report date: ${filing.reportDate}.` : '',
    filing.filingDate ? `Filing date: ${filing.filingDate}.` : '',
  ].filter(Boolean).join(' ');
  return {
    id: `sec-edgar-${symbol}-${accessionNumber}`,
    market: 'us',
    provider: 'sec',
    providerItemId: accessionNumber,
    symbol,
    companyName,
    formType: form,
    title: filingTitle({ symbol, companyName, form, primaryDocDescription: filing.primaryDocDescription }),
    summary,
    sourceName: 'SEC EDGAR',
    url: sourceUrl,
    filedAt,
    periodEndDate: filing.reportDate || null,
    fetchedAt: new Date().toISOString(),
    accessionNo: accessionNumber,
    rawPayload: {
      cik,
      companyName,
      ...filing,
    },
  };
}

export async function fetchSecEdgarFilings(params = {}) {
  const symbols = Array.isArray(params.symbols) ? params.symbols.map(stableSymbol).filter(Boolean) : [];
  if (symbols.length === 0) return [];
  const forms = formSet(params.forms);
  const daysBack = Math.max(1, Math.min(365, Number(params.daysBack || 14) || 14));
  const limitPerSymbol = Math.max(1, Math.min(50, Number(params.limitPerSymbol || 5) || 5));
  const requestDelayMs = Math.max(0, Math.min(2000, Number(params.requestDelayMs ?? 150)));
  const cutoffMs = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  const map = await tickerMap();
  const rows = [];

  for (let i = 0; i < symbols.length; i += 1) {
    const symbol = symbols[i];
    const company = map.get(symbol);
    if (!company) continue;
    if (i > 0 && requestDelayMs > 0) await sleep(requestDelayMs);
    const submissions = await fetchJson(SUBMISSIONS_URL.replace('{CIK}', company.cik));
    let count = 0;
    for (const filing of recentRows(submissions)) {
      const form = String(filing.form || '').trim().toUpperCase();
      if (!forms.has(form)) continue;
      const publishedAt = parseAcceptanceDateTime(filing.acceptanceDateTime, filing.filingDate);
      if (Date.parse(publishedAt) < cutoffMs) continue;
      rows.push(normalizeFiling({ symbol, cik: company.cik, companyName: company.companyName, filing }));
      count += 1;
      if (count >= limitPerSymbol) break;
    }
  }
  return rows;
}
