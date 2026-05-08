import { createPublicKey } from 'node:crypto';
import * as jose from 'jose';
import { config } from '../config.mjs';

function normalizePrivateKeyPem() {
  const b64 = String(process.env.SIGNAL_JWT_PRIVATE_KEY_B64 || '').trim();
  if (b64) {
    try {
      return Buffer.from(b64, 'base64').toString('utf8');
    } catch {
      return '';
    }
  }
  const raw = String(process.env.SIGNAL_JWT_PRIVATE_KEY || '').trim();
  if (!raw) return '';
  return raw.replace(/\\n/g, '\n');
}

/** @type {Promise<import('jose').KeyLike> | null} */
let signingKeyPromise = null;
/** @type {Promise<import('jose').KeyLike> | null} */
let verificationKeyPromise = null;

export function isAppUserJwtConfigured() {
  return normalizePrivateKeyPem().length > 0;
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
