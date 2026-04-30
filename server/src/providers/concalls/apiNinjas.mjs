import crypto from 'node:crypto';
import { getProviderSetting } from '../../providerSettings.mjs';

const EARNING_TRANSCRIPT_URL = 'https://api.api-ninjas.com/v1/earningstranscript';
const SNIPPET_MAX_CHARS = 6000;

function cleanText(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function clipText(value, maxChars = SNIPPET_MAX_CHARS) {
  const text = cleanText(value);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trimEnd()}\n...`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function parseTranscriptBody(data) {
  if (typeof data === 'string') return data;

  if (data && typeof data === 'object' && typeof data.transcript === 'string') {
    return data.transcript;
  }

  if (data && typeof data === 'object' && typeof data.text === 'string') {
    return data.text;
  }

  if (Array.isArray(data) && data.length > 0) {
    const joined = data
      .map((row) => {
        if (typeof row === 'string') return row;
        if (row && typeof row === 'object') return row.transcript || row.text || row.content || '';
        return '';
      })
      .filter(Boolean)
      .join('\n\n');
    return joined || null;
  }

  return null;
}

async function fetchApiNinjasTranscript(symbol, { year, quarter } = {}) {
  const setting = await getProviderSetting('ninjas');
  if (!setting.enabled) throw new Error('API_NINJAS_PROVIDER_DISABLED');
  if (!setting.apiKey) throw new Error('API_NINJAS_KEY_MISSING');

  const params = new URLSearchParams({ ticker: String(symbol || '').trim().toUpperCase() });
  if (year != null && quarter != null) {
    params.set('year', String(year));
    params.set('quarter', String(quarter));
  }

  const res = await fetch(`${EARNING_TRANSCRIPT_URL}?${params.toString()}`, {
    headers: { 'X-Api-Key': setting.apiKey },
  });
  const rawText = await res.text();
  if (!res.ok) {
    throw new Error(`API_NINJAS_TRANSCRIPT_${res.status}: ${rawText.slice(0, 240)}`);
  }
  let raw;
  try {
    raw = rawText ? JSON.parse(rawText) : null;
  } catch {
    raw = rawText;
  }
  return { transcript: parseTranscriptBody(raw), httpStatus: res.status, raw };
}

export function normalizeConcallTranscript({
  symbol,
  fiscalYear,
  fiscalQuarter,
  earningsDate,
  earningsHour,
  transcript,
  httpStatus = 200,
  rawPayload = null,
}) {
  const sym = String(symbol || '').trim().toUpperCase();
  const year = Number.isFinite(Number(fiscalYear)) ? Number(fiscalYear) : null;
  const quarter = Number.isFinite(Number(fiscalQuarter)) ? Number(fiscalQuarter) : null;
  const cleanTranscript = cleanText(transcript);
  const contentHash = sha256(cleanTranscript);
  const providerItemId = `${sym}|${year ?? ''}|${quarter ?? ''}`;
  return {
    id: `concall-${sym}-${year ?? 'latest'}-${quarter ?? 'latest'}`,
    provider: 'ninjas',
    providerItemId,
    symbol: sym,
    title: year && quarter ? `${sym} FY${year} Q${quarter} Earnings Call` : `${sym} Earnings Call`,
    fiscalYear: year,
    fiscalQuarter: quarter,
    earningsDate: earningsDate || null,
    earningsHour: earningsHour || null,
    transcript: cleanTranscript,
    transcriptSnippet: clipText(cleanTranscript),
    transcriptHash: contentHash,
    transcriptCharCount: cleanTranscript.length,
    summaryStatus: 'missing',
    summaryProvider: null,
    summaryModel: null,
    summaryBullets: [],
    guidance: '',
    risk: '',
    fetchedAt: new Date().toISOString(),
    httpStatus,
    rawPayload: rawPayload && typeof rawPayload === 'object' ? { providerShape: Array.isArray(rawPayload) ? 'array' : 'object' } : null,
  };
}

export async function fetchApiNinjasConcallTranscript(target) {
  const symbol = String(target?.symbol || '').trim().toUpperCase();
  if (!symbol) return null;
  const fiscalYear = target?.fiscalYear ?? target?.year ?? null;
  const fiscalQuarter = target?.fiscalQuarter ?? target?.quarter ?? null;
  const first = await fetchApiNinjasTranscript(symbol, {
    year: fiscalYear,
    quarter: fiscalQuarter,
  });
  let transcript = first.transcript;
  let httpStatus = first.httpStatus;
  let raw = first.raw;

  if ((!fiscalYear || !fiscalQuarter) && (!transcript || cleanText(transcript).length < 200)) {
    const fallback = await fetchApiNinjasTranscript(symbol);
    transcript = fallback.transcript;
    httpStatus = fallback.httpStatus || httpStatus;
    raw = fallback.raw ?? raw;
  }

  if (!transcript || cleanText(transcript).length < 200) {
    return null;
  }

  return normalizeConcallTranscript({
    symbol,
    fiscalYear,
    fiscalQuarter,
    earningsDate: target?.earningsDate ?? target?.date ?? null,
    earningsHour: target?.earningsHour ?? target?.hour ?? null,
    transcript,
    httpStatus,
    rawPayload: raw,
  });
}
