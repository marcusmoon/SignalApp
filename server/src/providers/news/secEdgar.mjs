import { config } from '../../config.mjs';
import { resolveDisclosureTypeCategory } from '../../disclosures/typeCategory.mjs';

const COMPANY_TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json';
const SUBMISSIONS_URL = 'https://data.sec.gov/submissions/CIK{CIK}.json';
const DEFAULT_FORMS = ['8-K', '10-Q', '10-K', 'S-1', '6-K', '20-F'];
const TICKER_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const ENRICH_FORMS = new Set(['8-K', '6-K', '20-F', '10-K', '10-Q']);
const FETCH_TIMEOUT_MS = 5000;

/** 8-K Item 번호 → 한국어 설명 */
const ITEM_LABELS = {
  '1.01': '주요 계약 체결',
  '1.02': '주요 계약 종료',
  '1.03': '파산·회생 절차',
  '2.01': '자산 취득 또는 처분',
  '2.02': '실적 발표',
  '2.03': '재무 의무 발생',
  '2.04': '채무불이행',
  '2.05': '사업 구조조정',
  '2.06': '자산 손상',
  '3.01': '상장폐지 위험',
  '3.02': '미등록 증권 발행',
  '3.03': '배당 변경',
  '4.01': '회계법인 변경',
  '4.02': '회계 오류 재작성',
  '5.01': '경영권 변동',
  '5.02': '임원 변경',
  '5.03': '정관·규정 변경',
  '5.04': '임시주주총회',
  '5.07': '주주총회 결의',
  '7.01': '공정공시(Reg FD)',
  '8.01': '기타 중요 사항',
  '9.01': '재무제표 및 첨부',
};

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

function primaryDocUrl(cik, accessionNumber, primaryDocument) {
  const cikInt = String(Number(cik));
  const accessionNoDashes = String(accessionNumber || '').replace(/-/g, '');
  const doc = String(primaryDocument || '').trim();
  if (!cikInt || !accessionNoDashes || !doc) return '';
  return `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accessionNoDashes}/${doc}`;
}

/** SEC 원문 HTML에서 "Item X.XX" 헤딩 추출 */
function extractItemsFromHtml(html) {
  const items = [];
  // Item X.XX 패턴 (테이블, 헤딩, 단락 등 다양한 위치)
  const pattern = /Item\s+(\d+\.\d+)[.\s ]*([A-Z][^\n<]{4,80})/gi;
  const seen = new Set();
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const code = match[1].trim();
    if (seen.has(code)) continue;
    // "9.01 Financial Statements" 같은 건 마지막에 항상 있으므로 단독이면 스킵
    seen.add(code);
    const rawLabel = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const label = ITEM_LABELS[code] || rawLabel.slice(0, 60);
    if (label) items.push({ code, label });
  }
  return items;
}

/** 8-K 원문을 fetch해서 Item 목록 반환. 실패 시 [] */
async function fetchFilingItems(cik, accessionNumber, primaryDocument, form) {
  if (!ENRICH_FORMS.has(String(form || '').toUpperCase())) return [];
  const url = primaryDocUrl(cik, accessionNumber, primaryDocument);
  if (!url) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': secUserAgent(), accept: 'text/html,*/*;q=0.8' },
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return [];
    // 첫 50KB만 읽어서 헤딩 추출 (문서 전체는 불필요)
    const reader = res.body.getReader();
    let html = '';
    while (html.length < 50_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += Buffer.from(value).toString('utf8');
    }
    reader.cancel().catch(() => {});
    return extractItemsFromHtml(html);
  } catch {
    return [];
  }
}

function filingTitle({ symbol, companyName, form, primaryDocDescription, items }) {
  const company = String(companyName || symbol || '').trim();
  // Item 정보가 있으면 핵심 이슈 기반 제목 생성
  if (items && items.length > 0) {
    const mainItems = items.filter((it) => it.code !== '9.01'); // 첨부파일 항목 제외
    if (mainItems.length > 0) {
      const labelStr = mainItems.slice(0, 2).map((it) => it.label).join(', ');
      return `${company || symbol}: ${labelStr}`;
    }
  }
  const label = String(primaryDocDescription || '').trim();
  if (label && label.toUpperCase() !== String(form || '').toUpperCase()) {
    return `${symbol} filed ${form}: ${label}`;
  }
  return `${symbol} filed ${form}${company && company !== symbol ? ` - ${company}` : ''}`;
}

function filingSummary({ companyName, symbol, form, filingDate, reportDate, items }) {
  const company = String(companyName || symbol || '').trim();
  const base = company
    ? `${company} ${form} 공시.`
    : `${symbol} ${form} 공시.`;
  if (items && items.length > 0) {
    const mainItems = items.filter((it) => it.code !== '9.01');
    if (mainItems.length > 0) {
      const details = mainItems.map((it) => `Item ${it.code} ${it.label}`).join('; ');
      return `${base} ${details}.${reportDate ? ` 보고 기간: ${reportDate}.` : ''}`;
    }
  }
  return [
    base,
    reportDate ? `보고 기간: ${reportDate}.` : '',
    filingDate ? `제출일: ${filingDate}.` : '',
  ].filter(Boolean).join(' ');
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

function normalizeFiling({ symbol, cik, companyName, filing, items = [] }) {
  const form = String(filing.form || '').trim().toUpperCase();
  const accessionNumber = String(filing.accessionNumber || '').trim();
  const sourceUrl = filingUrl(cik, accessionNumber);
  const filedAt = parseAcceptanceDateTime(filing.acceptanceDateTime, filing.filingDate);
  return {
    id: `sec-edgar-${symbol}-${accessionNumber}`,
    market: 'us',
    provider: 'sec',
    providerItemId: accessionNumber,
    symbol,
    companyName,
    formType: form,
    typeCategory: resolveDisclosureTypeCategory({
      provider: 'sec',
      market: 'us',
      formType: form,
    }),
    title: filingTitle({ symbol, companyName, form, primaryDocDescription: filing.primaryDocDescription, items }),
    summary: filingSummary({ companyName, symbol, form, filingDate: filing.filingDate, reportDate: filing.reportDate, items }),
    sourceName: 'SEC EDGAR',
    url: sourceUrl,
    filedAt,
    periodEndDate: filing.reportDate || null,
    fetchedAt: new Date().toISOString(),
    accessionNo: accessionNumber,
    rawPayload: {
      cik,
      companyName,
      items: items.map((it) => `${it.code} ${it.label}`),
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
  const enrichContent = params.enrichContent !== false; // 기본 true
  const enrichDelayMs = Math.max(0, Math.min(2000, Number(params.enrichDelayMs ?? 200)));
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
      // 8-K, 6-K 등 중요 공시는 원문에서 Item 항목 추출
      let items = [];
      if (enrichContent && ENRICH_FORMS.has(form) && filing.primaryDocument) {
        if (enrichDelayMs > 0) await sleep(enrichDelayMs);
        items = await fetchFilingItems(company.cik, filing.accessionNumber, filing.primaryDocument, form);
      }
      rows.push(normalizeFiling({ symbol, cik: company.cik, companyName: company.companyName, filing, items }));
      count += 1;
      if (count >= limitPerSymbol) break;
    }
  }
  return rows;
}
