/**
 * Expo Web 등 브라우저에서 다른 origin(포트)의 Signal API로 fetch할 때 필요한 CORS.
 * Origin이 없으면(예: curl) 헤더를 붙이지 않는다.
 */

function parseExplicitOrigins() {
  const raw = String(process.env.SIGNAL_CORS_ORIGINS || '').trim();
  if (!raw) return null;
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : null;
}

/** 개발용: localhost / 127.0.0.1 / ::1 의 http(s) Origin만 허용 */
function isImplicitLocalDevOrigin(origin) {
  try {
    const u = new URL(origin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const h = u.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  } catch {
    return false;
  }
}

/**
 * @param {string | undefined} origin
 * @returns {string | null} Access-Control-Allow-Origin 에 넣을 값(요청 Origin 그대로 echo)
 */
export function resolveAllowedCorsOrigin(origin) {
  if (!origin) return null;
  const explicit = parseExplicitOrigins();
  if (explicit) {
    return explicit.includes(origin) ? origin : null;
  }
  return isImplicitLocalDevOrigin(origin) ? origin : null;
}

export function isCorsApiPath(pathname) {
  return pathname === '/health' || pathname.startsWith('/v1');
}

/**
 * @returns {boolean} true면 이미 응답을 끝냈다(OPTIONS 프리플라이트).
 */
export function tryHandleCorsPreflight(req, res, pathname) {
  if (req.method !== 'OPTIONS' || !isCorsApiPath(pathname)) return false;
  const allow = resolveAllowedCorsOrigin(req.headers.origin);
  if (!allow) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('CORS origin not allowed');
    return true;
  }
  const reqHdr = req.headers['access-control-request-headers'];
  res.writeHead(204, {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'GET,HEAD,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': reqHdr || 'authorization, content-type, accept',
    'access-control-max-age': '86400',
    vary: 'Origin',
  });
  res.end();
  return true;
}

/**
 * 실제 GET/POST 응답에 CORS 헤더를 붙인다. json()/writeHead 호출 전에 실행한다.
 */
export function applyCorsHeadersIfNeeded(req, res, pathname) {
  if (!isCorsApiPath(pathname)) return;
  const allow = resolveAllowedCorsOrigin(req.headers.origin);
  if (!allow) return;
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Vary', 'Origin');
}
