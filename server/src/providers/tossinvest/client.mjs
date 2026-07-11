import { TossInvestError, throwFromResponse } from './errors.mjs';
import { getTossInvestAccessToken } from './auth.mjs';
import { assertTossInvestConfigured } from './settings.mjs';

const MAX_ATTEMPTS = 4;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(value) {
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const date = Date.parse(String(value || ''));
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return 1000;
}

function buildQuery(params = {}) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    q.set(key, String(value));
  }
  const text = q.toString();
  return text ? `?${text}` : '';
}

/**
 * @param {string} path e.g. `/api/v1/prices`
 * @param {{
 *   method?: 'GET'|'POST',
 *   params?: Record<string, string|number|boolean|null|undefined>,
 *   body?: unknown,
 *   account?: boolean,
 *   accountSeq?: number|null,
 * }} [options]
 */
export async function tossInvestRequest(path, options = {}) {
  const setting = await assertTossInvestConfigured();
  const method = options.method || 'GET';
  const url = `${setting.baseUrl}${path}${buildQuery(options.params)}`;
  const needsAccount = options.account === true;
  const accountSeq = options.accountSeq ?? setting.accountSeq;
  if (needsAccount && accountSeq == null) throw new Error('TOSSINVEST_ACCOUNT_SEQ_MISSING');

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const accessToken = await getTossInvestAccessToken({ forceRefresh: attempt > 1 && lastError?.code === 'expired-token' });
    const headers = {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    };
    if (needsAccount) headers['x-tossinvest-account'] = String(accountSeq);
    let body = undefined;
    if (options.body != null) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    const res = await fetch(url, { method, headers, body });
    const requestId = res.headers.get('x-request-id');
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (res.status === 429 && attempt < MAX_ATTEMPTS) {
      const waitMs = parseRetryAfterMs(res.headers.get('retry-after')) + Math.floor(Math.random() * 250);
      await sleep(waitMs);
      continue;
    }

    if (res.status === 401 && attempt < MAX_ATTEMPTS) {
      const code = json?.error?.code || json?.error;
      if (code === 'expired-token' || code === 'invalid-token') {
        lastError = new TossInvestError(code, json?.error?.message || 'Unauthorized', { status: 401, requestId });
        await getTossInvestAccessToken({ forceRefresh: true });
        continue;
      }
    }

    if (!res.ok) throwFromResponse(res.status, json, requestId);
    return json?.result ?? json;
  }

  throw lastError || new TossInvestError('rate-limit-exceeded', 'Toss Invest request failed after retries');
}
