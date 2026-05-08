import * as jose from 'jose';

import { isSocialProviderConfigured } from './socialAuthConfig.mjs';

const googleJwks = jose.createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleJwks = jose.createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

function clean(v) {
  return String(v || '').trim();
}

/**
 * @returns {Promise<{ providerUserId: string, email: string, displayName: string, profileImageUrl: string, payload: object }>}
 */
export async function verifyGoogleIdToken(idToken, runtime) {
  if (!isSocialProviderConfigured(runtime, 'google')) throw new Error('APP_USER_SOCIAL_NOT_CONFIGURED');
  const audiences = [runtime.google.webClientId, runtime.google.iosClientId, runtime.google.androidClientId].filter(Boolean);
  if (!audiences.length) throw new Error('APP_USER_SOCIAL_NOT_CONFIGURED');
  let payload;
  try {
    ({ payload } = await jose.jwtVerify(idToken, googleJwks, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: audiences,
    }));
  } catch {
    throw new Error('APP_USER_SOCIAL_INVALID_TOKEN');
  }
  const sub = clean(payload.sub);
  if (!sub) throw new Error('APP_USER_SOCIAL_INVALID_TOKEN');
  return {
    providerUserId: sub,
    email: clean(payload.email),
    displayName: clean(payload.name),
    profileImageUrl: clean(payload.picture),
    payload: { emailVerified: !!payload.email_verified },
  };
}

/**
 * @returns {Promise<{ providerUserId: string, email: string, displayName: string, profileImageUrl: string, payload: object }>}
 */
export async function verifyAppleIdToken(idToken, nonce, runtime) {
  if (!isSocialProviderConfigured(runtime, 'apple')) throw new Error('APP_USER_SOCIAL_NOT_CONFIGURED');
  const clientId = runtime.apple.clientId;
  if (!clientId) throw new Error('APP_USER_SOCIAL_NOT_CONFIGURED');
  let payload;
  try {
    ({ payload } = await jose.jwtVerify(idToken, appleJwks, {
      issuer: 'https://appleid.apple.com',
      audience: clientId,
    }));
  } catch {
    throw new Error('APP_USER_SOCIAL_INVALID_TOKEN');
  }
  if (nonce && payload.nonce && String(payload.nonce) !== String(nonce)) throw new Error('APP_USER_SOCIAL_INVALID_TOKEN');
  const sub = clean(payload.sub);
  if (!sub) throw new Error('APP_USER_SOCIAL_INVALID_TOKEN');
  return {
    providerUserId: sub,
    email: clean(payload.email),
    displayName: '',
    profileImageUrl: '',
    payload: { emailVerified: !!payload.email_verified },
  };
}

function logKakaoFailure(label, status, snippet) {
  const s = String(snippet || '').slice(0, 400);
  console.warn(`[social:kakao] ${label} HTTP ${status || '—'} ${s}`);
}

async function kakaoProfileFromAccessToken(accessToken) {
  const res = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text().catch(() => '');
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = {};
  }
  if (!res.ok) {
    logKakaoFailure('kapi/user/me', res.status, text);
    throw new Error('APP_USER_SOCIAL_KAKAO_UPSTREAM');
  }
  const rawId = json.id != null ? String(json.id) : json.user_id != null ? String(json.user_id) : '';
  const id = clean(rawId);
  if (!id) {
    logKakaoFailure('kapi/user/me (no id)', res.status, text);
    throw new Error('APP_USER_SOCIAL_INVALID_TOKEN');
  }
  const acct = json.kakao_account || {};
  const prof = acct.profile || {};
  const email = clean(acct.email || '');
  return {
    providerUserId: id,
    email,
    displayName: clean(prof.nickname || prof.display_name || ''),
    profileImageUrl: clean(prof.profile_image_url || ''),
    payload: { hasEmail: !!acct.has_email },
  };
}

/**
 * 카카오 네이티브 SDK 등에서 발급받은 액세스 토큰으로 프로필 확인 (client_secret 불필요).
 * @returns {Promise<{ providerUserId: string, email: string, displayName: string, profileImageUrl: string, payload: object }>}
 */
export async function verifyKakaoAccessToken(accessToken, runtime) {
  if (!isSocialProviderConfigured(runtime, 'kakao')) throw new Error('APP_USER_SOCIAL_NOT_CONFIGURED');
  const at = clean(accessToken);
  if (!at) throw new Error('APP_USER_SOCIAL_INVALID_TOKEN');
  return kakaoProfileFromAccessToken(at);
}

export async function exchangeKakaoCode(code, redirectUri, runtime) {
  if (!isSocialProviderConfigured(runtime, 'kakao')) throw new Error('APP_USER_SOCIAL_NOT_CONFIGURED');
  const clientId = runtime.kakao.clientId;
  const clientSecret = runtime.kakao.clientSecret;
  if (!clientId || !clean(clientSecret)) throw new Error('APP_USER_SOCIAL_NOT_CONFIGURED');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code: clean(code),
  });
  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
  });
  const text = await res.text().catch(() => '');
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = {};
  }
  if (!res.ok || !json.access_token) {
    logKakaoFailure('kauth/token', res.status, text);
    throw new Error(json.error ? 'APP_USER_SOCIAL_KAKAO_UPSTREAM' : 'APP_USER_SOCIAL_INVALID_TOKEN');
  }
  return kakaoProfileFromAccessToken(String(json.access_token));
}

async function naverProfileFromAccessToken(accessToken) {
  const res = await fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.resultcode !== '00') throw new Error('APP_USER_SOCIAL_INVALID_TOKEN');
  const r = json.response || {};
  const id = clean(r.id);
  if (!id) throw new Error('APP_USER_SOCIAL_INVALID_TOKEN');
  return {
    providerUserId: id,
    email: clean(r.email),
    displayName: clean(r.name || r.nickname || ''),
    profileImageUrl: clean(r.profile_image || ''),
    payload: {},
  };
}

/**
 * @returns {Promise<{ providerUserId: string, email: string, displayName: string, profileImageUrl: string, payload: object }>}
 */
export async function exchangeNaverCode(code, state, runtime) {
  if (!isSocialProviderConfigured(runtime, 'naver')) throw new Error('APP_USER_SOCIAL_NOT_CONFIGURED');
  const clientId = runtime.naver.clientId;
  const clientSecret = runtime.naver.clientSecret;
  if (!clientId || !clientSecret) throw new Error('APP_USER_SOCIAL_NOT_CONFIGURED');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code: clean(code),
    state: clean(state),
  });
  const res = await fetch('https://nid.naver.com/oauth2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error('APP_USER_SOCIAL_INVALID_TOKEN');
  return naverProfileFromAccessToken(String(json.access_token));
}

/**
 * @param {object} body — idToken, nonce (apple), code/redirectUri 또는 accessToken (kakao), state (naver)
 */
export async function resolveSocialProfile(provider, body, runtime) {
  const p = String(provider || '').toLowerCase();
  if (p === 'google') return verifyGoogleIdToken(clean(body.idToken), runtime);
  if (p === 'apple') return verifyAppleIdToken(clean(body.idToken), body.nonce, runtime);
  if (p === 'kakao') {
    if (clean(body.accessToken)) return verifyKakaoAccessToken(body.accessToken, runtime);
    return exchangeKakaoCode(body.code, clean(body.redirectUri), runtime);
  }
  if (p === 'naver') return exchangeNaverCode(body.code, clean(body.state), runtime);
  throw new Error('APP_USER_SOCIAL_UNSUPPORTED');
}
