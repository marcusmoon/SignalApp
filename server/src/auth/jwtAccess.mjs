import { createPublicKey } from 'node:crypto';
import * as jose from 'jose';
import { config } from '../config.mjs';

function stripWrappingQuotes(value) {
  const v = String(value || '').trim();
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1).trim();
  }
  return v;
}

function looksLikePrivateKeyPem(pem) {
  return /-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(pem) && /-----END (?:RSA )?PRIVATE KEY-----/.test(pem);
}

function normalizePrivateKeyPem() {
  const b64 = stripWrappingQuotes(process.env.SIGNAL_JWT_PRIVATE_KEY_B64).replace(/\s+/g, '');
  if (b64) {
    try {
      const pem = Buffer.from(b64, 'base64').toString('utf8').trim();
      return looksLikePrivateKeyPem(pem) ? pem : '';
    } catch {
      return '';
    }
  }
  const raw = stripWrappingQuotes(process.env.SIGNAL_JWT_PRIVATE_KEY);
  if (!raw) return '';
  const pem = raw.replace(/\\n/g, '\n').trim();
  return looksLikePrivateKeyPem(pem) ? pem : '';
}

function privateKeySource() {
  if (stripWrappingQuotes(process.env.SIGNAL_JWT_PRIVATE_KEY_B64)) return 'SIGNAL_JWT_PRIVATE_KEY_B64';
  if (stripWrappingQuotes(process.env.SIGNAL_JWT_PRIVATE_KEY)) return 'SIGNAL_JWT_PRIVATE_KEY';
  return '';
}

/** @type {Promise<import('jose').KeyLike> | null} */
let signingKeyPromise = null;
/** @type {Promise<import('jose').KeyLike> | null} */
let verificationKeyPromise = null;

export function isAppUserJwtConfigured() {
  return normalizePrivateKeyPem().length > 0;
}

export async function getAppUserJwtConfigStatus() {
  const source = privateKeySource();
  const configured = isAppUserJwtConfigured();
  if (!configured) {
    return { configured: false, source: source || null, valid: false };
  }
  try {
    await requireSigningKeyPromise();
    return { configured: true, source, valid: true };
  } catch {
    signingKeyPromise = null;
    verificationKeyPromise = null;
    return { configured: true, source, valid: false };
  }
}

function requireSigningKeyPromise() {
  const pem = normalizePrivateKeyPem();
  if (!pem) {
    throw new Error('SIGNAL_JWT_PRIVATE_KEY_NOT_CONFIGURED');
  }
  if (!signingKeyPromise) {
    signingKeyPromise = jose.importPKCS8(pem, 'RS256');
  }
  return signingKeyPromise;
}

function requireVerificationKeyPromise() {
  const pem = normalizePrivateKeyPem();
  if (!pem) {
    throw new Error('SIGNAL_JWT_PRIVATE_KEY_NOT_CONFIGURED');
  }
  if (!verificationKeyPromise) {
    const publicPem = createPublicKey(pem).export({ type: 'spki', format: 'pem' });
    verificationKeyPromise = jose.importSPKI(String(publicPem), 'RS256');
  }
  return verificationKeyPromise;
}

/**
 * @param {string} userId
 * @param {string} sessionId
 */
export async function signAppUserAccessToken(userId, sessionId) {
  const key = await requireSigningKeyPromise();
  return new jose.SignJWT({ typ: 'access' })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(userId)
    .setIssuer(config.jwtIssuer)
    .setAudience(config.jwtAudience)
    .setJti(sessionId)
    .setIssuedAt()
    .setExpirationTime(`${config.jwtAccessTtlSeconds}s`)
    .sign(key);
}

/**
 * @param {string} token
 * @returns {Promise<{ sub: string; sid: string } | null>}
 */
export async function verifyAppUserAccessToken(token) {
  const raw = String(token || '').trim();
  if (!raw || !isAppUserJwtConfigured()) return null;
  try {
    const key = await requireVerificationKeyPromise();
    const { payload } = await jose.jwtVerify(raw, key, {
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
    });
    if (payload.typ !== 'access') return null;
    const sub = String(payload.sub || '');
    const sid = String(payload.jti || '');
    if (!sub || !sid) return null;
    return { sub, sid };
  } catch {
    return null;
  }
}

function isLikelyJwt(token) {
  const parts = String(token || '').split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

export { isLikelyJwt };
