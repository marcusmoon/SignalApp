import { inflateRawSync } from 'node:zlib';

import { config } from '../../config.mjs';
import { getProviderSetting } from '../../providerSettings.mjs';
import { compactYmdInTimezone } from '../../time/utc.mjs';

const CORP_CODE_URL = 'https://opendart.fss.or.kr/api/corpCode.xml';
const LIST_URL = 'https://opendart.fss.or.kr/api/list.json';
const VIEWER_URL = 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=';
const DEFAULT_PBLNTF_TY = ['B', 'C', 'D', 'I'];
const CORP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let corpCache = null;
let corpCacheAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function stableKrSymbol(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 6 ? digits : '';
}

function parseRceptDate(value) {
  const raw = String(value || '').trim();
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(raw);
  if (compact) {
    const [, year, month, day] = compact;
    return new Date(`${year}-${month}-${day}T00:00:00+09:00`).toISOString();
  }
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  return new Date().toISOString();
}

function pblntfTySet(values) {
  const source = Array.isArray(values) && values.length > 0 ? values : DEFAULT_PBLNTF_TY;
  return new Set(source.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean));
}

async function dartApiKey() {
  const setting = await getProviderSetting('dart');
  if (setting.enabled === false) throw new Error('DART_PROVIDER_DISABLED');
  const key = String(setting.apiKey || config.dartApiKey || '').trim();
  if (!key) throw new Error('DART_API_KEY_MISSING');
  return key;
}

function extractZipPayload(buffer) {
  const sig = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if (sig < 0) throw new Error('DART_CORP_ZIP_INVALID');
  const compressionMethod = buffer.readUInt16LE(sig + 8);
  const compressedSize = buffer.readUInt32LE(sig + 18);
  const fileNameLength = buffer.readUInt16LE(sig + 26);
  const extraLength = buffer.readUInt16LE(sig + 28);
  const dataStart = sig + 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
  if (compressionMethod === 0) return compressed;
  if (compressionMethod === 8) return inflateRawSync(compressed);
  throw new Error(`DART_CORP_ZIP_UNSUPPORTED:${compressionMethod}`);
}

function parseCorpCodeXml(xml) {
  const map = new Map();
  const blockRe = /<list>([\s\S]*?)<\/list>/g;
  let match;
  while ((match = blockRe.exec(xml)) !== null) {
    const block = match[1];
    const corpCode = /<corp_code>([^<]+)<\/corp_code>/i.exec(block)?.[1]?.trim();
    const stockCode = /<stock_code>([^<]+)<\/stock_code>/i.exec(block)?.[1]?.trim();
    if (!corpCode || !stockCode) continue;
    const symbol = stableKrSymbol(stockCode);
    if (!symbol) continue;
    map.set(symbol, corpCode);
  }
  return map;
}

async function stockToCorpCodeMap(apiKey) {
  const now = Date.now();
  if (corpCache && now - corpCacheAt < CORP_CACHE_TTL_MS) return corpCache;

  const res = await fetch(`${CORP_CODE_URL}?crtfc_key=${encodeURIComponent(apiKey)}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DART_CORP_${res.status}: ${body.slice(0, 200)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = String(res.headers.get('content-type') || '').toLowerCase();
  const xml = contentType.includes('xml') && !contentType.includes('zip')
    ? buffer.toString('utf8')
    : extractZipPayload(buffer).toString('utf8');

  if (xml.includes('<status>')) {
    const status = /<status>([^<]+)<\/status>/i.exec(xml)?.[1]?.trim();
    const message = /<message>([^<]+)<\/message>/i.exec(xml)?.[1]?.trim();
    throw new Error(`DART_CORP_${status || 'ERROR'}: ${message || xml.slice(0, 200)}`);
  }

  const map = parseCorpCodeXml(xml);
  if (map.size === 0) throw new Error('DART_CORP_EMPTY');
  corpCache = map;
  corpCacheAt = now;
  return map;
}

async function fetchDisclosureList(apiKey, params) {
  const url = new URL(LIST_URL);
  url.searchParams.set('crtfc_key', apiKey);
  for (const [key, value] of Object.entries(params || {})) {
    if (value == null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DART_LIST_${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  if (String(json?.status || '') !== '000') {
    throw new Error(`DART_LIST_${json?.status || 'ERROR'}: ${json?.message || 'request failed'}`);
  }
  return Array.isArray(json?.list) ? json.list : [];
}

function normalizeDisclosure({ symbol, corpName, filing }) {
  const rceptNo = String(filing.rcept_no || '').trim();
  const reportName = String(filing.report_nm || '').trim();
  const company = String(corpName || filing.corp_name || symbol || '').trim();
  const filedAt = parseRceptDate(filing.rcept_dt);
  const summary = [
    company ? `${company} DART 공시.` : 'DART 공시.',
    reportName,
    filing.rcept_dt ? `접수일: ${filing.rcept_dt}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return {
    id: `dart-${symbol}-${rceptNo}`,
    market: 'kr',
    provider: 'dart',
    providerItemId: rceptNo,
    symbol,
    companyName: company,
    formType: reportName,
    title: company ? `${company}: ${reportName}` : reportName,
    summary,
    sourceName: 'DART',
    url: rceptNo ? `${VIEWER_URL}${rceptNo}` : 'https://dart.fss.or.kr/',
    filedAt,
    periodEndDate: null,
    fetchedAt: new Date().toISOString(),
    receiptNo: rceptNo,
    rawPayload: {
      symbol,
      corpName: company,
      ...filing,
    },
  };
}

function matchesPblntfTy(filing, allowed) {
  if (!allowed || allowed.size === 0) return true;
  const apiTy = String(filing?.pblntf_ty || '').trim().toUpperCase();
  if (apiTy && allowed.has(apiTy)) return true;

  const reportName = String(filing?.report_nm || '').trim();
  if (!reportName) return true;
  for (const ty of allowed) {
    if (ty === 'B' && /주요사항/.test(reportName)) return true;
    if (ty === 'C' && /발행|증권신고|공모|채권/.test(reportName)) return true;
    if (ty === 'D' && /지분|주식|대량보유|공개매수|소유상황|임원|주요주주/.test(reportName)) return true;
    if (ty === 'I' && /거래소|코스피|코스닥/.test(reportName)) return true;
    if (ty === 'A' && /사업보고|반기보고|분기보고|감사보고|연결감사/.test(reportName)) return true;
    if (ty === 'E' && /기타|자율공시|경영사항/.test(reportName)) return true;
  }
  return false;
}

async function fetchFilingsForSymbol({
  apiKey,
  symbol,
  corpCode,
  bgnDe,
  endDe,
  allowedTypes,
  limitPerSymbol,
}) {
  const merged = new Map();
  const types = [...allowedTypes];

  for (const pblntfTy of types) {
    const filings = await fetchDisclosureList(apiKey, {
      corp_code: corpCode,
      bgn_de: bgnDe,
      end_de: endDe,
      pblntf_ty: pblntfTy,
      page_count: Math.min(100, Math.max(limitPerSymbol, limitPerSymbol * 2)),
      sort: 'date',
      sort_mth: 'desc',
    });

    for (const filing of filings) {
      if (!matchesPblntfTy(filing, allowedTypes)) continue;
      const rceptNo = String(filing.rcept_no || '').trim();
      if (!rceptNo || merged.has(rceptNo)) continue;
      merged.set(
        rceptNo,
        normalizeDisclosure({
          symbol,
          corpName: filing.corp_name,
          filing,
        }),
      );
    }
  }

  if (merged.size === 0) {
    const filings = await fetchDisclosureList(apiKey, {
      corp_code: corpCode,
      bgn_de: bgnDe,
      end_de: endDe,
      page_count: Math.min(100, limitPerSymbol * 3),
      sort: 'date',
      sort_mth: 'desc',
    });
    for (const filing of filings) {
      if (!matchesPblntfTy(filing, allowedTypes)) continue;
      const rceptNo = String(filing.rcept_no || '').trim();
      if (!rceptNo || merged.has(rceptNo)) continue;
      merged.set(
        rceptNo,
        normalizeDisclosure({
          symbol,
          corpName: filing.corp_name,
          filing,
        }),
      );
    }
  }

  return [...merged.values()]
    .sort((a, b) => String(b.filedAt || '').localeCompare(String(a.filedAt || '')))
    .slice(0, limitPerSymbol);
}

export async function fetchDartFilings(params = {}) {
  const apiKey = await dartApiKey();
  const symbols = Array.isArray(params.symbols) ? params.symbols.map(stableKrSymbol).filter(Boolean) : [];
  if (symbols.length === 0) {
    console.warn('[dart] no symbols to query (check market list / job params)');
    return [];
  }

  const daysBack = Math.max(1, Math.min(90, Number(params.daysBack || 14) || 14));
  const limitPerSymbol = Math.max(1, Math.min(50, Number(params.limitPerSymbol || 8) || 8));
  const requestDelayMs = Math.max(0, Math.min(2000, Number(params.requestDelayMs ?? 200)));
  const allowedTypes = pblntfTySet(params.pblntfTy);
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const bgnDe = compactYmdInTimezone(start, 'Asia/Seoul');
  const endDe = compactYmdInTimezone(end, 'Asia/Seoul');

  const corpMap = await stockToCorpCodeMap(apiKey);
  const rows = [];

  for (let i = 0; i < symbols.length; i += 1) {
    const symbol = symbols[i];
    const corpCode = corpMap.get(symbol);
    if (!corpCode) {
      console.warn(`[dart] skip symbol without corp_code mapping: ${symbol}`);
      continue;
    }
    if (i > 0 && requestDelayMs > 0) await sleep(requestDelayMs);

    const filings = await fetchFilingsForSymbol({
      apiKey,
      symbol,
      corpCode,
      bgnDe,
      endDe,
      allowedTypes,
      limitPerSymbol,
    });
    rows.push(...filings);
  }

  return rows;
}
