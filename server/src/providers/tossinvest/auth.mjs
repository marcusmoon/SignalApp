import { TossInvestError, throwFromResponse } from './errors.mjs';
import { assertTossInvestConfigured } from './settings.mjs';

/** @type {Map<string, { accessToken: string, expiresAt: number }>} */
const tokenCache = new Map();

const TOKEN_SKEW_MS = 60_000;

function cacheKey(baseUrl, clientId) {
  return `${baseUrl}::${clientId}`;
}

function parseTokenResponse(json) {
  const accessToken = cleanText(json?.access_token);
  const expiresIn = Number(json?.expires_in);
  if (!accessToken) throw new TossInvestError('invalid-token-response', 'Toss Invest token response missing access_token');
  const ttlMs = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1000 : 86_400_000;
  return { accessToken, expiresAt: Date.now() + ttlMs };
}

function cleanText(value) {
  return String(value || '').trim();
}

export function clearTossInvestTokenCache() {
  tokenCache.clear();
}

export async function getTossInvestAccessToken({ forceRefresh = false } = {}) {
  const setting = await assertTossInvestConfigured();
  const key = cacheKey(setting.baseUrl, setting.clientId);
  const cached = tokenCache.get(key);
  if (!forceRefresh && cached && cached.expiresAt > Date.now() + TOKEN_SKEW_MS) {
    return cached.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: setting.clientId,
    client_secret: setting.clientSecret,
  });
  const res = await fetch(`${setting.baseUrl}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    if (json?.error) {
      throw new TossInvestError(json.error, json.error_description || 'Toss Invest token request failed', { status: res.status });
    }
    throwFromResponse(res.status, json, res.headers.get('x-request-id'));
  }

  const parsed = parseTokenResponse(json);
  tokenCache.set(key, parsed);
  return parsed.accessToken;
}
