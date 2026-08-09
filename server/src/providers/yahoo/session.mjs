/**
 * Yahoo Finance crumb + cookie session for unofficial JSON APIs
 * (calendar visualization, etc.).
 *
 * Yahoo HTML responses can exceed Node/undici's default header size, so
 * bootstrap uses node:https with a raised maxHeaderSize.
 */

import https from 'node:https';
import { URL } from 'node:url';

const DEFAULT_UA = 'Mozilla/5.0 (compatible; SignalApp/yahoo-session)';
const MAX_HEADER_SIZE = 262_144;

function listSetCookies(headers) {
  const raw = headers['set-cookie'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw.filter(Boolean) : [raw];
}

function mergeCookieHeader(existing, setCookieHeaders = []) {
  const map = new Map();
  for (const part of String(existing || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    map.set(part.slice(0, eq), part.slice(eq + 1));
  }
  for (const header of setCookieHeaders) {
    const first = String(header || '').split(';')[0] || '';
    const eq = first.indexOf('=');
    if (eq <= 0) continue;
    map.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
  }
  return [...map.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
}

function httpsRequest(url, { method = 'GET', headers = {}, body = null } = {}) {
  const target = new URL(url);
  const payload = body == null ? null : Buffer.from(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method,
        headers: {
          ...headers,
          ...(payload ? { 'content-length': String(payload.length) } : {}),
        },
        maxHeaderSize: MAX_HEADER_SIZE,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            status: res.statusCode || 0,
            ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
            headers: res.headers,
            buffer,
            text: () => Promise.resolve(buffer.toString('utf8')),
            arrayBuffer: () =>
              Promise.resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)),
          });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * @param {{ userAgent?: string, bootstrapUrls?: string[] }} [opts]
 * @returns {Promise<{ cookie: string, crumb: string, userAgent: string }>}
 */
export async function createYahooSession(opts = {}) {
  const userAgent = String(opts.userAgent || DEFAULT_UA).trim() || DEFAULT_UA;
  const bootstrapUrls =
    Array.isArray(opts.bootstrapUrls) && opts.bootstrapUrls.length > 0
      ? opts.bootstrapUrls
      : ['https://finance.yahoo.com/', 'https://finance.yahoo.com/calendar/economic'];

  let cookie = '';
  for (const url of bootstrapUrls) {
    const res = await httpsRequest(url, {
      headers: {
        'user-agent': userAgent,
        accept: 'text/html,application/xhtml+xml',
        ...(cookie ? { cookie } : {}),
      },
    });
    cookie = mergeCookieHeader(cookie, listSetCookies(res.headers));
  }

  const crumbRes = await httpsRequest('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: {
      'user-agent': userAgent,
      accept: 'text/plain,*/*',
      ...(cookie ? { cookie } : {}),
    },
  });
  cookie = mergeCookieHeader(cookie, listSetCookies(crumbRes.headers));
  const crumb = String(await crumbRes.text()).trim();
  if (!crumbRes.ok || !crumb || crumb.length > 64 || /error|html|login/i.test(crumb)) {
    throw new Error(`YAHOO_CRUMB_FAILED:${crumbRes.status}:${crumb.slice(0, 80)}`);
  }

  return { cookie, crumb, userAgent };
}

/**
 * Authenticated Yahoo fetch using a session from `createYahooSession`.
 * Uses node:https (raised maxHeaderSize) for reliability.
 *
 * @param {string} url
 * @param {{ session: { cookie: string, crumb: string, userAgent: string }, method?: string, body?: string|null, headers?: Record<string,string> }} opts
 */
export async function yahooFetch(url, { session, method = 'GET', body = null, headers = {} } = {}) {
  if (!session?.crumb || !session?.cookie) throw new Error('YAHOO_SESSION_REQUIRED');
  const target = new URL(url);
  if (!target.searchParams.has('crumb')) target.searchParams.set('crumb', session.crumb);

  return httpsRequest(target.toString(), {
    method,
    body,
    headers: {
      'user-agent': session.userAgent,
      accept: 'application/json',
      origin: 'https://finance.yahoo.com',
      referer: 'https://finance.yahoo.com/calendar/economic',
      cookie: session.cookie,
      ...headers,
    },
  });
}
