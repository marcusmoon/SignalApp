import crypto from 'node:crypto';
import {
  isAppUserJwtConfigured,
  isLikelyJwt,
  signAppUserAccessToken,
  verifyAppUserAccessToken,
} from '../auth/jwtAccess.mjs';
import { config } from '../config.mjs';
import {
  insertAppUserTermAcceptancesInDb,
  validateRequiredTermsAcceptedInDb,
} from './legalTerms.mjs';
import { nowIso } from './time.mjs';

const SESSION_DAYS = 90;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function cleanText(value) {
  return String(value || '').trim();
}

const SOCIAL_PROVIDERS = new Set(['google', 'apple', 'kakao', 'naver']);

function deriveSocialEmail(provider, email, sub) {
  const normalized = normalizeEmail(email);
  if (normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return normalized;
  const safeSub = cleanText(sub).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 96);
  const p = String(provider || '').toLowerCase();
  return `${p}-${safeSub}@users.signal.local`;
}

function overrideSocialProfile(profile, signupProfile = null) {
  if (!signupProfile || typeof signupProfile !== 'object') return profile;
  const next = { ...profile };
  if (typeof signupProfile.email === 'string' && cleanText(signupProfile.email)) {
    const email = normalizeEmail(signupProfile.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('APP_USER_EMAIL_INVALID');
    next.email = email;
  }
  if (typeof signupProfile.nickname === 'string') {
    const nickname = cleanText(signupProfile.nickname);
    if (nickname.length < 2) throw new Error('APP_USER_NICKNAME_REQUIRED');
    next.displayName = nickname.slice(0, 60);
  }
  if (typeof signupProfile.profileImageUrl === 'string') {
    next.profileImageUrl = cleanText(signupProfile.profileImageUrl);
  }
  return next;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, row) {
  if (!row?.password_hash || !row?.password_salt) return false;
  const { hash } = hashPassword(password, row.password_salt);
  const saved = Buffer.from(String(row.password_hash), 'hex');
  const candidate = Buffer.from(hash, 'hex');
  return saved.length === candidate.length && crypto.timingSafeEqual(saved, candidate);
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function otpHash(code, salt) {
  return crypto.createHash('sha256').update(`${cleanText(code)}:${cleanText(salt)}`).digest('hex');
}

function maskEmail(email) {
  const [local, domain] = normalizeEmail(email).split('@');
  if (!local || !domain) return '';
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(2, local.length - 2))}@${domain}`;
}

function hashProviderUserId(provider, providerUserId) {
  const raw = `${cleanText(provider).toLowerCase()}:${cleanText(providerUserId)}`;
  if (!raw.endsWith(':')) return crypto.createHash('sha256').update(raw).digest('hex');
  return '';
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    profileImageUrl: row.profile_image_url || '',
    authProvider: row.auth_provider || 'password',
    hasPassword: Boolean(row.password_hash && row.password_salt),
    active: Number(row.active) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function publicIdentity(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerUserId: row.provider_user_id,
    email: row.email || '',
    displayName: row.display_name || '',
    profileImageUrl: row.profile_image_url || '',
    linkedAt: row.linked_at || row.created_at || null,
    disconnectedAt: row.disconnected_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function publicAccountEvent(row) {
  if (!row) return null;
  let payload = {};
  try {
    payload = JSON.parse(row.payload || '{}');
  } catch {
    payload = {};
  }
  return {
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type,
    actorType: row.actor_type || 'user',
    actorId: row.actor_id || '',
    identityId: row.identity_id || '',
    provider: row.provider || '',
    providerUserIdHash: row.provider_user_id_hash || '',
    payload,
    createdAt: row.created_at,
  };
}

function insertAppUserAccountEventInDb(
  db,
  {
    userId,
    eventType,
    actorType = 'user',
    actorId = '',
    identityId = '',
    provider = '',
    providerUserId = '',
    payload = {},
    createdAt = nowIso(),
  },
) {
  const cleanUserId = cleanText(userId);
  const cleanEventType = cleanText(eventType);
  if (!cleanUserId || !cleanEventType) return null;
  const providerUserIdHash = hashProviderUserId(provider, providerUserId);
  const payloadJson = JSON.stringify(payload && typeof payload === 'object' ? payload : {});
  const id = crypto.randomUUID();
  db.prepare(
    `
      INSERT INTO app_user_account_events (
        id, user_id, event_type, actor_type, actor_id, identity_id, provider,
        provider_user_id_hash, payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    id,
    cleanUserId,
    cleanEventType,
    cleanText(actorType) || 'user',
    cleanText(actorId) || null,
    cleanText(identityId) || null,
    cleanText(provider).toLowerCase() || null,
    providerUserIdHash || null,
    payloadJson,
    createdAt,
  );
  return publicAccountEvent(db.prepare('SELECT * FROM app_user_account_events WHERE id = ?').get(id));
}

function withdrawnEmailForUserId(userId) {
  return `withdrawn+${cleanText(userId)}@users.signal.local`;
}

function withdrawnProviderUserIdForIdentity(identityId) {
  return `withdrawn:${cleanText(identityId)}`;
}

function disconnectedProviderUserIdForIdentity(identityId) {
  return `disconnected:${cleanText(identityId)}`;
}

function releaseDisconnectedIdentityInDb(db, identity, now = nowIso()) {
  if (!identity?.id || !identity.disconnected_at) return false;
  db.prepare(
    `
      UPDATE app_user_identities
      SET
        provider_user_id = ?,
        email = NULL,
        display_name = NULL,
        profile_image_url = NULL,
        payload = '{}',
        updated_at = ?
      WHERE id = ?
    `,
  ).run(disconnectedProviderUserIdForIdentity(identity.id), now, identity.id);
  return true;
}

function tombstoneAppUserLoginIdentifiersInDb(db, userId, now = nowIso()) {
  const id = cleanText(userId);
  const existing = db.prepare('SELECT * FROM app_users WHERE id = ?').get(id);
  if (!existing) return;
  db.prepare(
    `
      UPDATE app_users
      SET
        email = ?,
        nickname = ?,
        profile_image_url = '',
        password_hash = NULL,
        password_salt = NULL,
        auth_provider = 'withdrawn',
        active = 0,
        updated_at = ?
      WHERE id = ?
    `,
  ).run(withdrawnEmailForUserId(id), 'Withdrawn user', now, id);

  const identities = db.prepare('SELECT id FROM app_user_identities WHERE user_id = ?').all(id);
  const updateIdentity = db.prepare(
    `
      UPDATE app_user_identities
      SET
        provider_user_id = ?,
        email = NULL,
        display_name = NULL,
        profile_image_url = NULL,
        disconnected_at = COALESCE(disconnected_at, ?),
        payload = '{}',
        updated_at = ?
      WHERE id = ?
    `,
  );
  for (const identity of identities) {
    updateIdentity.run(withdrawnProviderUserIdForIdentity(identity.id), now, now, identity.id);
  }
}

function releaseInactiveUserLoginIdentifiersInDb(db, userId, now = nowIso()) {
  const row = db.prepare('SELECT id, active FROM app_users WHERE id = ?').get(cleanText(userId));
  if (!row || Number(row.active) === 1) return false;
  tombstoneAppUserLoginIdentifiersInDb(db, row.id, now);
  return true;
}

function adminUserRow(row) {
  if (!row) return null;
  return {
    ...publicUser(row),
    activeSessionCount: Number(row.active_session_count) || 0,
    deviceCount: Number(row.device_count) || 0,
    latestSessionAt: row.latest_session_at || null,
    latestDeviceAt: row.latest_device_at || null,
    notificationCount: Number(row.notification_count) || 0,
    queuedNotificationCount: Number(row.queued_notification_count) || 0,
  };
}

function createSessionInDb(db, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    `
      INSERT INTO app_user_sessions (token_hash, user_id, created_at, expires_at, revoked_at)
      VALUES (?, ?, ?, ?, NULL)
    `,
  ).run(tokenHash(token), userId, now, expiresAt);
  return { token, expiresAt };
}

function validateDeviceId(deviceId) {
  const d = cleanText(deviceId);
  if (d.length < 8 || d.length > 200) return null;
  return d;
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} userId
 * @param {string} deviceId
 */
async function createJwtRefreshSessionInDb(db, userId, deviceId) {
  const device = validateDeviceId(deviceId);
  if (!device) throw new Error('APP_USER_DEVICE_ID_REQUIRED');
  const now = nowIso();
  db.prepare(
    `UPDATE app_user_refresh_sessions SET revoked_at = ? WHERE user_id = ? AND device_id = ? AND revoked_at IS NULL`,
  ).run(now, userId, device);
  const sid = crypto.randomUUID();
  const refreshRaw = crypto.randomBytes(32).toString('base64url');
  const refreshHash = tokenHash(refreshRaw);
  const refreshExpiresAt = new Date(Date.now() + config.jwtRefreshTtlDays * 86400000).toISOString();
  db.prepare(
    `
      INSERT INTO app_user_refresh_sessions (id, user_id, device_id, refresh_hash, created_at, expires_at, revoked_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
    `,
  ).run(sid, userId, device, refreshHash, now, refreshExpiresAt);
  const accessToken = await signAppUserAccessToken(userId, sid);
  const accessExpiresAt = new Date(Date.now() + config.jwtAccessTtlSeconds * 1000).toISOString();
  return {
    accessToken,
    refreshToken: refreshRaw,
    accessExpiresAt,
    refreshExpiresAt,
    deviceId: device,
  };
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} userId
 * @param {string} deviceId
 */
async function resolveSessionForUser(db, userId, deviceId) {
  if (isAppUserJwtConfigured()) {
    return createJwtRefreshSessionInDb(db, userId, deviceId);
  }
  const legacy = createSessionInDb(db, userId);
  return {
    accessToken: legacy.token,
    refreshToken: '',
    accessExpiresAt: legacy.expiresAt,
    refreshExpiresAt: legacy.expiresAt,
    deviceId: validateDeviceId(deviceId) || '',
  };
}

export async function createAppUserInDb(
  db,
  { email, password, nickname, profileImageUrl = '', locale = 'ko', acceptedTerms = [], deviceId = '' },
) {
  const normalizedEmail = normalizeEmail(email);
  const userPassword = String(password || '');
  const cleanNickname = cleanText(nickname);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('APP_USER_EMAIL_INVALID');
  if (userPassword.length < 8) throw new Error('APP_USER_PASSWORD_TOO_SHORT');
  if (cleanNickname.length < 2) throw new Error('APP_USER_NICKNAME_REQUIRED');
  const exists = db.prepare('SELECT id, active FROM app_users WHERE email = ?').get(normalizedEmail);
  if (exists && Number(exists.active) === 1) throw new Error('APP_USER_EMAIL_EXISTS');
  const requiredTerms = validateRequiredTermsAcceptedInDb(db, acceptedTerms, locale);
  if (exists) releaseInactiveUserLoginIdentifiersInDb(db, exists.id);
  const { hash, salt } = hashPassword(userPassword);
  const id = crypto.randomUUID();
  const now = nowIso();
  db.prepare(
    `
      INSERT INTO app_users (
        id, email, nickname, profile_image_url, password_hash, password_salt,
        auth_provider, active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'password', 1, ?, ?)
    `,
  ).run(id, normalizedEmail, cleanNickname, cleanText(profileImageUrl), hash, salt, now, now);
  insertAppUserTermAcceptancesInDb(db, id, requiredTerms);
  const row = db.prepare('SELECT * FROM app_users WHERE id = ?').get(id);
  const session = await resolveSessionForUser(db, id, deviceId);
  return { user: publicUser(row), session };
}

export async function loginAppUserInDb(db, { email, password, deviceId = '' }) {
  const normalizedEmail = normalizeEmail(email);
  const row = db.prepare('SELECT * FROM app_users WHERE email = ?').get(normalizedEmail);
  if (!row || Number(row.active) !== 1 || !verifyPassword(password, row)) throw new Error('APP_USER_LOGIN_FAILED');
  const session = await resolveSessionForUser(db, row.id, deviceId);
  return { user: publicUser(row), session };
}

export function listAppUserIdentitiesInDb(db, userId) {
  return db
    .prepare(
      `
        SELECT *
        FROM app_user_identities
        WHERE user_id = ? AND disconnected_at IS NULL
        ORDER BY linked_at DESC, created_at DESC
      `,
    )
    .all(cleanText(userId))
    .map(publicIdentity);
}

export function listAppUserAccountEventsInDb(db, userId, { limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit)) || 50));
  const safeOffset = Math.max(0, Math.floor(Number(offset)) || 0);
  return db
    .prepare(
      `
        SELECT *
        FROM app_user_account_events
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `,
    )
    .all(cleanText(userId), safeLimit, safeOffset)
    .map(publicAccountEvent);
}

export function listAppUserDevicesForUserInDb(db, userId, { limit = 50 } = {}) {
  const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit)) || 50));
  return db
    .prepare(
      `
        SELECT
          id,
          user_id,
          platform,
          push_token,
          device_name,
          active,
          created_at,
          updated_at
        FROM app_user_devices
        WHERE user_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT ?
      `,
    )
    .all(cleanText(userId), safeLimit)
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      platform: row.platform || '',
      pushToken: row.push_token || '',
      deviceName: row.device_name || '',
      active: Number(row.active) === 1,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    }));
}

export function listAppUserAuthSessionsInDb(db, userId, { limit = 50 } = {}) {
  const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit)) || 50));
  const now = nowIso();
  return db
    .prepare(
      `
        SELECT
          'signal_access' AS session_type,
          substr(token_hash, 1, 14) AS session_key,
          user_id,
          NULL AS device_id,
          created_at,
          expires_at,
          revoked_at
        FROM app_user_sessions
        WHERE user_id = @userId
        UNION ALL
        SELECT
          'signal_refresh' AS session_type,
          id AS session_key,
          user_id,
          device_id,
          created_at,
          expires_at,
          revoked_at
        FROM app_user_refresh_sessions
        WHERE user_id = @userId
        ORDER BY created_at DESC
        LIMIT @limit
      `,
    )
    .all({ userId: cleanText(userId), limit: safeLimit })
    .map((row) => {
      const expired = String(row.expires_at || '') <= now;
      return {
        type: row.session_type,
        key: row.session_key || '',
        userId: row.user_id,
        deviceId: row.device_id || '',
        active: !row.revoked_at && !expired,
        expired,
        createdAt: row.created_at || null,
        expiresAt: row.expires_at || null,
        revokedAt: row.revoked_at || null,
      };
    });
}

export function setAppUserPasswordInDb(db, userId, { password }) {
  const userPassword = String(password || '');
  if (userPassword.length < 8) throw new Error('APP_USER_PASSWORD_TOO_SHORT');
  const existing = db.prepare('SELECT * FROM app_users WHERE id = ? AND active = 1').get(cleanText(userId));
  if (!existing) throw new Error('APP_USER_NOT_FOUND');
  const { hash, salt } = hashPassword(userPassword);
  const now = nowIso();
  db.prepare('UPDATE app_users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?').run(
    hash,
    salt,
    now,
    existing.id,
  );
  return publicUser(db.prepare('SELECT * FROM app_users WHERE id = ?').get(existing.id));
}

export function requestAppUserEmailChangeInDb(db, userId, { email }) {
  const existing = db.prepare('SELECT * FROM app_users WHERE id = ? AND active = 1').get(cleanText(userId));
  if (!existing) throw new Error('APP_USER_NOT_FOUND');
  const nextEmail = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) throw new Error('APP_USER_EMAIL_INVALID');
  if (nextEmail === normalizeEmail(existing.email)) throw new Error('APP_USER_EMAIL_SAME');
  const emailRow = db.prepare('SELECT id, active FROM app_users WHERE email = ?').get(nextEmail);
  if (emailRow && Number(emailRow.active) === 1) throw new Error('APP_USER_EMAIL_EXISTS');
  if (emailRow) releaseInactiveUserLoginIdentifiersInDb(db, emailRow.id);

  const now = nowIso();
  db.prepare(
    `UPDATE app_user_email_change_requests SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL`,
  ).run(now, existing.id);

  const id = crypto.randomUUID();
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const salt = crypto.randomBytes(12).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare(
    `
      INSERT INTO app_user_email_change_requests (
        id, user_id, email, code_hash, code_salt, attempts, created_at, expires_at, consumed_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, NULL)
    `,
  ).run(id, existing.id, nextEmail, otpHash(code, salt), salt, now, expiresAt);
  insertAppUserAccountEventInDb(db, {
    userId: existing.id,
    eventType: 'email_change_requested',
    payload: { targetEmail: maskEmail(nextEmail), expiresAt },
    createdAt: now,
  });
  return {
    request: {
      id,
      email: nextEmail,
      maskedEmail: maskEmail(nextEmail),
      expiresAt,
    },
    code,
  };
}

export function confirmAppUserEmailChangeInDb(db, userId, { requestId, code }) {
  const user = db.prepare('SELECT * FROM app_users WHERE id = ? AND active = 1').get(cleanText(userId));
  if (!user) throw new Error('APP_USER_NOT_FOUND');
  const request = db
    .prepare('SELECT * FROM app_user_email_change_requests WHERE id = ? AND user_id = ?')
    .get(cleanText(requestId), user.id);
  if (!request || request.consumed_at) throw new Error('APP_USER_EMAIL_CHANGE_INVALID');
  if (String(request.expires_at || '') <= nowIso()) throw new Error('APP_USER_EMAIL_CHANGE_EXPIRED');
  if (Number(request.attempts) >= 5) throw new Error('APP_USER_EMAIL_CHANGE_TOO_MANY_ATTEMPTS');
  const emailRow = db.prepare('SELECT id, active FROM app_users WHERE email = ? AND id <> ?').get(request.email, user.id);
  if (emailRow && Number(emailRow.active) === 1) throw new Error('APP_USER_EMAIL_EXISTS');
  if (emailRow) releaseInactiveUserLoginIdentifiersInDb(db, emailRow.id);

  const candidateHash = otpHash(code, request.code_salt);
  const saved = Buffer.from(String(request.code_hash || ''), 'hex');
  const candidate = Buffer.from(candidateHash, 'hex');
  if (saved.length !== candidate.length || !crypto.timingSafeEqual(saved, candidate)) {
    db.prepare('UPDATE app_user_email_change_requests SET attempts = attempts + 1 WHERE id = ?').run(request.id);
    throw new Error('APP_USER_EMAIL_CHANGE_CODE_INVALID');
  }

  const now = nowIso();
  db.prepare('UPDATE app_users SET email = ?, updated_at = ? WHERE id = ?').run(request.email, now, user.id);
  db.prepare('UPDATE app_user_email_change_requests SET consumed_at = ? WHERE id = ?').run(now, request.id);
  insertAppUserAccountEventInDb(db, {
    userId: user.id,
    eventType: 'email_changed',
    payload: { email: maskEmail(request.email) },
    createdAt: now,
  });
  return publicUser(db.prepare('SELECT * FROM app_users WHERE id = ?').get(user.id));
}

export function disconnectAppUserIdentityInDb(db, userId, identityId) {
  const user = db.prepare('SELECT * FROM app_users WHERE id = ? AND active = 1').get(cleanText(userId));
  if (!user) throw new Error('APP_USER_NOT_FOUND');
  const identity = db
    .prepare('SELECT * FROM app_user_identities WHERE id = ? AND user_id = ? AND disconnected_at IS NULL')
    .get(cleanText(identityId), user.id);
  if (!identity) throw new Error('APP_USER_IDENTITY_NOT_FOUND');
  const remainingIdentityCount =
    Number(
      db
        .prepare(
          'SELECT COUNT(*) AS count FROM app_user_identities WHERE user_id = ? AND disconnected_at IS NULL AND id <> ?',
        )
        .get(user.id, identity.id)?.count,
    ) || 0;
  const hasPassword = Boolean(user.password_hash && user.password_salt);
  if (!hasPassword && remainingIdentityCount === 0) throw new Error('APP_USER_PASSWORD_REQUIRED_BEFORE_UNLINK');
  const now = nowIso();
  db.prepare(
    `
      UPDATE app_user_identities
      SET
        provider_user_id = ?,
        email = NULL,
        display_name = NULL,
        profile_image_url = NULL,
        disconnected_at = ?,
        payload = '{}',
        updated_at = ?
      WHERE id = ?
    `,
  ).run(disconnectedProviderUserIdForIdentity(identity.id), now, now, identity.id);
  insertAppUserAccountEventInDb(db, {
    userId: user.id,
    eventType: 'social_unlinked',
    identityId: identity.id,
    provider: identity.provider,
    providerUserId: identity.provider_user_id,
    payload: {
      remainingIdentityCount,
      hasPassword,
    },
    createdAt: now,
  });
  return publicIdentity(db.prepare('SELECT * FROM app_user_identities WHERE id = ?').get(identity.id));
}

function nicknameFromSocialProfile(profile, derivedEmail) {
  let n = cleanText(profile.displayName);
  if (n.length >= 2) return n.slice(0, 60);
  const at = derivedEmail.indexOf('@');
  const local = at > 0 ? derivedEmail.slice(0, at) : 'user';
  const base = local.replace(/[^a-zA-Z0-9._-가-힣]/g, '_').slice(0, 24) || 'user';
  return `User_${base}`.slice(0, 60);
}

export async function loginOrRegisterSocialUserInDb(
  db,
  { provider, profile, deviceId = '', locale = 'ko', acceptedTerms = [], signupProfile = null },
) {
  const p = String(provider || '').toLowerCase();
  if (!SOCIAL_PROVIDERS.has(p)) throw new Error('APP_USER_SOCIAL_UNSUPPORTED');
  const sub = cleanText(profile.providerUserId);
  if (!sub) throw new Error('APP_USER_SOCIAL_INVALID_PROFILE');

  const existingIdentity = db
    .prepare('SELECT * FROM app_user_identities WHERE provider = ? AND provider_user_id = ?')
    .get(p, sub);

  const now = nowIso();
  const payloadJson = JSON.stringify(
    profile.payload && typeof profile.payload === 'object' ? profile.payload : {},
  );

  if (existingIdentity) {
    const userRow = db.prepare('SELECT * FROM app_users WHERE id = ?').get(existingIdentity.user_id);
    if (!userRow) throw new Error('APP_USER_NOT_FOUND');
    if (Number(userRow.active) === 1) {
      if (existingIdentity.disconnected_at) {
        releaseDisconnectedIdentityInDb(db, existingIdentity, now);
      } else {
        db.prepare(
          `
          UPDATE app_user_identities
          SET updated_at = ?, email = ?, display_name = ?, profile_image_url = ?, payload = ?
          WHERE id = ?
        `,
        ).run(
          now,
          profile.email || null,
          profile.displayName || null,
          profile.profileImageUrl || null,
          payloadJson,
          existingIdentity.id,
        );
        const session = await resolveSessionForUser(db, userRow.id, deviceId);
        return { user: publicUser(userRow), session };
      }
    } else {
      releaseInactiveUserLoginIdentifiersInDb(db, userRow.id, now);
    }
  }

  if (!isAppUserJwtConfigured()) throw new Error('APP_USER_JWT_NOT_CONFIGURED');

  const signup = overrideSocialProfile(profile, signupProfile);
  const derivedEmail = deriveSocialEmail(p, signup.email, sub);
  const requiredTerms = validateRequiredTermsAcceptedInDb(db, acceptedTerms, locale);
  const emailRow = db.prepare('SELECT id, active FROM app_users WHERE email = ?').get(derivedEmail);
  if (emailRow && Number(emailRow.active) === 1) throw new Error('APP_USER_SOCIAL_EMAIL_CONFLICT');
  if (emailRow) releaseInactiveUserLoginIdentifiersInDb(db, emailRow.id, now);
  const nickname = nicknameFromSocialProfile(signup, derivedEmail);
  const id = crypto.randomUUID();
  db.prepare(
    `
      INSERT INTO app_users (
        id, email, nickname, profile_image_url, password_hash, password_salt,
        auth_provider, active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, NULL, NULL, ?, 1, ?, ?)
    `,
  ).run(id, derivedEmail, nickname, cleanText(signup.profileImageUrl), p, now, now);
  insertAppUserTermAcceptancesInDb(db, id, requiredTerms);

  const identityId = crypto.randomUUID();
  db.prepare(
    `
      INSERT INTO app_user_identities (
        id, user_id, provider, provider_user_id, email, display_name, profile_image_url,
        linked_at, disconnected_at, payload, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `,
  ).run(
    identityId,
    id,
    p,
    sub,
    signup.email || null,
    signup.displayName || null,
    signup.profileImageUrl || null,
    now,
    payloadJson,
    now,
    now,
  );
  insertAppUserAccountEventInDb(db, {
    userId: id,
    eventType: 'social_linked',
    identityId,
    provider: p,
    providerUserId: sub,
    payload: {
      reason: 'social_signup',
      profileEmailPresent: Boolean(profile.email),
    },
    createdAt: now,
  });

  const row = db.prepare('SELECT * FROM app_users WHERE id = ?').get(id);
  const session = await resolveSessionForUser(db, id, deviceId);
  return { user: publicUser(row), session };
}

export function linkAppUserSocialIdentityInDb(db, userId, provider, profile) {
  const user = db.prepare('SELECT * FROM app_users WHERE id = ? AND active = 1').get(cleanText(userId));
  if (!user) throw new Error('APP_USER_NOT_FOUND');
  const p = String(provider || '').toLowerCase();
  if (!SOCIAL_PROVIDERS.has(p)) throw new Error('APP_USER_SOCIAL_UNSUPPORTED');
  const sub = cleanText(profile.providerUserId);
  if (!sub) throw new Error('APP_USER_SOCIAL_INVALID_PROFILE');

  const row = db.prepare('SELECT * FROM app_user_identities WHERE provider = ? AND provider_user_id = ?').get(p, sub);
  const now = nowIso();
  const payloadJson = JSON.stringify(
    profile.payload && typeof profile.payload === 'object' ? profile.payload : {},
  );

  if (row) {
    if (row.user_id !== user.id) {
      if (row.disconnected_at) {
        releaseDisconnectedIdentityInDb(db, row, now);
      } else {
        const owner = db.prepare('SELECT id, active FROM app_users WHERE id = ?').get(row.user_id);
        if (!owner || Number(owner.active) === 1) throw new Error('APP_USER_SOCIAL_IDENTITY_TAKEN');
        releaseInactiveUserLoginIdentifiersInDb(db, owner.id, now);
      }
    } else {
      db.prepare(
        `
        UPDATE app_user_identities
        SET disconnected_at = NULL, linked_at = ?, updated_at = ?, email = ?, display_name = ?, profile_image_url = ?, payload = ?
        WHERE id = ?
      `,
      ).run(
        now,
        now,
        profile.email || null,
        profile.displayName || null,
        profile.profileImageUrl || null,
        payloadJson,
        row.id,
      );
      const identity = publicIdentity(db.prepare('SELECT * FROM app_user_identities WHERE id = ?').get(row.id));
      const userRow = db.prepare('SELECT * FROM app_users WHERE id = ?').get(user.id);
      insertAppUserAccountEventInDb(db, {
        userId: user.id,
        eventType: 'social_linked',
        identityId: row.id,
        provider: p,
        providerUserId: sub,
        payload: {
          reason: row.disconnected_at ? 'social_relinked' : 'social_refreshed',
          profileEmailPresent: Boolean(profile.email),
        },
        createdAt: now,
      });
      return { identity, user: publicUser(userRow) };
    }
  }

  const id = crypto.randomUUID();
  db.prepare(
    `
      INSERT INTO app_user_identities (
        id, user_id, provider, provider_user_id, email, display_name, profile_image_url,
        linked_at, disconnected_at, payload, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `,
  ).run(
    id,
    user.id,
    p,
    sub,
    profile.email || null,
    profile.displayName || null,
    profile.profileImageUrl || null,
    now,
    payloadJson,
    now,
    now,
  );
  insertAppUserAccountEventInDb(db, {
    userId: user.id,
    eventType: 'social_linked',
    identityId: id,
    provider: p,
    providerUserId: sub,
    payload: {
      reason: 'manual_link',
      profileEmailPresent: Boolean(profile.email),
    },
    createdAt: now,
  });
  const identity = publicIdentity(db.prepare('SELECT * FROM app_user_identities WHERE id = ?').get(id));
  const userRow = db.prepare('SELECT * FROM app_users WHERE id = ?').get(user.id);
  return { identity, user: publicUser(userRow) };
}

export async function verifyAppUserTokenInDb(db, token) {
  const raw = String(token || '').trim();
  if (!raw) return null;
  if (isLikelyJwt(raw)) {
    const claims = await verifyAppUserAccessToken(raw);
    if (!claims) return null;
    const now = nowIso();
    const sess = db
      .prepare(
        `
          SELECT user_id
          FROM app_user_refresh_sessions
          WHERE id = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > ?
        `,
      )
      .get(claims.sid, claims.sub, now);
    if (!sess) return null;
    const row = db.prepare('SELECT * FROM app_users WHERE id = ? AND active = 1').get(claims.sub);
    return publicUser(row);
  }
  const hash = tokenHash(raw);
  const session = db
    .prepare(
      `
        SELECT token_hash, user_id, expires_at, revoked_at
        FROM app_user_sessions
        WHERE token_hash = ?
      `,
    )
    .get(hash);
  if (!session || session.revoked_at) return null;
  const expiresMs = new Date(session.expires_at || 0).getTime();
  if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) return null;
  const row = db.prepare('SELECT * FROM app_users WHERE id = ? AND active = 1').get(session.user_id);
  return publicUser(row);
}

export async function revokeAppUserTokenInDb(db, token) {
  const raw = String(token || '').trim();
  const now = nowIso();
  if (isLikelyJwt(raw)) {
    const claims = await verifyAppUserAccessToken(raw);
    if (claims) {
      db.prepare(
        `UPDATE app_user_refresh_sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
      ).run(now, claims.sid, claims.sub);
    }
    return { revokedAt: now };
  }
  db.prepare('UPDATE app_user_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL').run(now, tokenHash(raw));
  return { revokedAt: now };
}

export async function refreshAppUserSessionInDb(db, { refreshToken, deviceId }) {
  if (!isAppUserJwtConfigured()) throw new Error('APP_USER_JWT_NOT_CONFIGURED');
  const device = validateDeviceId(deviceId);
  if (!device) throw new Error('APP_USER_DEVICE_ID_REQUIRED');
  const raw = String(refreshToken || '').trim();
  if (!raw) throw new Error('APP_USER_REFRESH_REQUIRED');
  const hash = tokenHash(raw);
  const now = nowIso();
  const row = db
    .prepare(
      `
        SELECT *
        FROM app_user_refresh_sessions
        WHERE refresh_hash = ? AND device_id = ? AND revoked_at IS NULL AND expires_at > ?
      `,
    )
    .get(hash, device, now);
  if (!row) throw new Error('APP_USER_REFRESH_INVALID');
  const userRow = db.prepare('SELECT * FROM app_users WHERE id = ? AND active = 1').get(row.user_id);
  if (!userRow) throw new Error('APP_USER_REFRESH_INVALID');
  const newRefresh = crypto.randomBytes(32).toString('base64url');
  const newHash = tokenHash(newRefresh);
  const refreshExpiresAt = new Date(Date.now() + config.jwtRefreshTtlDays * 86400000).toISOString();
  db.prepare(
    `UPDATE app_user_refresh_sessions SET refresh_hash = ?, expires_at = ? WHERE id = ? AND revoked_at IS NULL`,
  ).run(newHash, refreshExpiresAt, row.id);
  const accessToken = await signAppUserAccessToken(row.user_id, row.id);
  const accessExpiresAt = new Date(Date.now() + config.jwtAccessTtlSeconds * 1000).toISOString();
  return {
    user: publicUser(userRow),
    session: {
      accessToken,
      refreshToken: newRefresh,
      accessExpiresAt,
      refreshExpiresAt,
      deviceId: device,
    },
  };
}

export function updateAppUserProfileInDb(db, userId, patch = {}) {
  const existing = db.prepare('SELECT * FROM app_users WHERE id = ? AND active = 1').get(String(userId || ''));
  if (!existing) throw new Error('APP_USER_NOT_FOUND');
  const updates = [];
  const params = [];
  if (typeof patch.nickname === 'string') {
    const nickname = cleanText(patch.nickname);
    if (nickname.length < 2) throw new Error('APP_USER_NICKNAME_REQUIRED');
    updates.push('nickname = ?');
    params.push(nickname);
  }
  if (typeof patch.profileImageUrl === 'string') {
    updates.push('profile_image_url = ?');
    params.push(cleanText(patch.profileImageUrl));
  }
  if (updates.length === 0) return publicUser(existing);
  const now = nowIso();
  updates.push('updated_at = ?');
  params.push(now, existing.id);
  db.prepare(`UPDATE app_users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  return publicUser(db.prepare('SELECT * FROM app_users WHERE id = ?').get(existing.id));
}

export function withdrawAppUserInDb(db, userId) {
  const id = cleanText(userId);
  const existing = db.prepare('SELECT * FROM app_users WHERE id = ? AND active = 1').get(id);
  if (!existing) throw new Error('APP_USER_NOT_FOUND');
  const now = nowIso();
  const identityCount =
    Number(db.prepare('SELECT COUNT(*) AS count FROM app_user_identities WHERE user_id = ?').get(id)?.count) || 0;
  const activeSessionCount =
    Number(
      db
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM app_user_sessions
            WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
          `,
        )
        .get(id, now)?.count,
    ) || 0;
  const activeRefreshSessionCount =
    Number(
      db
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM app_user_refresh_sessions
            WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
          `,
        )
        .get(id, now)?.count,
    ) || 0;
  const activeDeviceCount =
    Number(db.prepare('SELECT COUNT(*) AS count FROM app_user_devices WHERE user_id = ? AND active = 1').get(id)?.count) ||
    0;
  tombstoneAppUserLoginIdentifiersInDb(db, id, now);
  db.prepare('UPDATE app_user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(now, id);
  db.prepare('UPDATE app_user_refresh_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(now, id);
  db.prepare('UPDATE app_user_devices SET active = 0, updated_at = ? WHERE user_id = ?').run(now, id);
  insertAppUserAccountEventInDb(db, {
    userId: id,
    eventType: 'account_withdrawn',
    payload: {
      identityCount,
      revokedSessionCount: activeSessionCount,
      revokedRefreshSessionCount: activeRefreshSessionCount,
      deactivatedDeviceCount: activeDeviceCount,
    },
    createdAt: now,
  });
  return { withdrawnAt: now };
}

export function listAppUsersInDb(db, { q = '', active = '', limit = 50, offset = 0 } = {}) {
  const params = {};
  const where = [];
  const query = cleanText(q).toLowerCase();
  if (query) {
    params.q = `%${query}%`;
    where.push('(LOWER(u.email) LIKE @q OR LOWER(u.nickname) LIKE @q OR LOWER(u.id) LIKE @q)');
  }
  if (active === '1' || active === 'true') where.push('u.active = 1');
  if (active === '0' || active === 'false') where.push('u.active = 0');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit)) || 50));
  const safeOffset = Math.max(0, Math.floor(Number(offset)) || 0);
  const total = Number(
    db.prepare(`SELECT COUNT(*) AS count FROM app_users u ${whereSql}`).get(params)?.count,
  ) || 0;
  const now = nowIso();
  const rows = db
    .prepare(
      `
        SELECT
          u.*,
          (
            (
              SELECT COUNT(*)
              FROM app_user_sessions s
              WHERE s.user_id = u.id
                AND s.revoked_at IS NULL
                AND s.expires_at > @now
            )
            + (
              SELECT COUNT(*)
              FROM app_user_refresh_sessions r
              WHERE r.user_id = u.id
                AND r.revoked_at IS NULL
                AND r.expires_at > @now
            )
          ) AS active_session_count,
          (
            SELECT COUNT(*)
            FROM app_user_devices d
            WHERE d.user_id = u.id AND d.active = 1
          ) AS device_count,
          (
            SELECT MAX(created_ts)
            FROM (
              SELECT s.created_at AS created_ts FROM app_user_sessions s WHERE s.user_id = u.id
              UNION ALL
              SELECT r.created_at AS created_ts FROM app_user_refresh_sessions r WHERE r.user_id = u.id
            )
          ) AS latest_session_at,
          (
            SELECT MAX(d.updated_at)
            FROM app_user_devices d
            WHERE d.user_id = u.id
          ) AS latest_device_at,
          (
            SELECT COUNT(*)
            FROM notification_items n
            WHERE n.app_user_id = u.id OR (n.target_type = 'user' AND n.target_key = u.id)
          ) AS notification_count,
          (
            SELECT COUNT(*)
            FROM notification_items n
            WHERE (n.app_user_id = u.id OR (n.target_type = 'user' AND n.target_key = u.id))
              AND COALESCE(n.status, 'queued') = 'queued'
          ) AS queued_notification_count
        FROM app_users u
        ${whereSql}
        ORDER BY u.created_at DESC
        LIMIT @limit OFFSET @offset
      `,
    )
    .all({ ...params, now, limit: safeLimit, offset: safeOffset });
  return { rows: rows.map(adminUserRow), total, limit: safeLimit, offset: safeOffset };
}

export function listAppUserDevicesInDb(db, { q = '', active = '', platform = '', limit = 50, offset = 0 } = {}) {
  const params = {};
  const where = [];
  const query = cleanText(q).toLowerCase();
  if (query) {
    params.q = `%${query}%`;
    where.push(
      '(LOWER(COALESCE(u.email, "")) LIKE @q OR LOWER(COALESCE(u.nickname, "")) LIKE @q OR LOWER(COALESCE(d.device_name, "")) LIKE @q OR LOWER(COALESCE(d.push_token, "")) LIKE @q)',
    );
  }
  if (active === '1' || active === 'true') where.push('d.active = 1');
  if (active === '0' || active === 'false') where.push('d.active = 0');
  const cleanPlatform = cleanText(platform).toLowerCase();
  if (cleanPlatform) {
    params.platform = cleanPlatform;
    where.push('LOWER(COALESCE(d.platform, "")) = @platform');
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit)) || 50));
  const safeOffset = Math.max(0, Math.floor(Number(offset)) || 0);
  const total = Number(
    db
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM app_user_devices d
          LEFT JOIN app_users u ON u.id = d.user_id
          ${whereSql}
        `,
      )
      .get(params)?.count,
  ) || 0;
  const rows = db
    .prepare(
      `
        SELECT
          d.id,
          d.user_id,
          d.platform,
          d.push_token,
          d.device_name,
          d.active,
          d.created_at,
          d.updated_at,
          u.email,
          u.nickname
        FROM app_user_devices d
        LEFT JOIN app_users u ON u.id = d.user_id
        ${whereSql}
        ORDER BY d.updated_at DESC
        LIMIT @limit OFFSET @offset
      `,
    )
    .all({ ...params, limit: safeLimit, offset: safeOffset })
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      email: row.email || '',
      nickname: row.nickname || '',
      platform: row.platform || '',
      pushToken: row.push_token || '',
      deviceName: row.device_name || '',
      active: Number(row.active) === 1,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    }));
  return { rows, total, limit: safeLimit, offset: safeOffset };
}

export function updateAppUserDeviceAdminInDb(db, deviceId, patch = {}) {
  const id = cleanText(deviceId);
  const existing = db.prepare('SELECT * FROM app_user_devices WHERE id = ?').get(id);
  if (!existing) throw new Error('APP_USER_DEVICE_NOT_FOUND');
  const updates = [];
  const params = [];
  if (typeof patch.active === 'boolean') {
    updates.push('active = ?');
    params.push(patch.active ? 1 : 0);
  }
  if (updates.length === 0) return existing;
  const now = nowIso();
  updates.push('updated_at = ?');
  params.push(now, id);
  db.prepare(`UPDATE app_user_devices SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const row = db.prepare('SELECT * FROM app_user_devices WHERE id = ?').get(id);
  return {
    id: row.id,
    userId: row.user_id,
    platform: row.platform || '',
    pushToken: row.push_token || '',
    deviceName: row.device_name || '',
    active: Number(row.active) === 1,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export function getAppUserInDb(db, userId) {
  const params = { userId: String(userId || ''), now: nowIso() };
  const row = db
    .prepare(
      `
        SELECT
          u.*,
          (
            (
              SELECT COUNT(*)
              FROM app_user_sessions s
              WHERE s.user_id = u.id
                AND s.revoked_at IS NULL
                AND s.expires_at > @now
            )
            + (
              SELECT COUNT(*)
              FROM app_user_refresh_sessions r
              WHERE r.user_id = u.id
                AND r.revoked_at IS NULL
                AND r.expires_at > @now
            )
          ) AS active_session_count,
          (
            SELECT COUNT(*)
            FROM app_user_devices d
            WHERE d.user_id = u.id AND d.active = 1
          ) AS device_count,
          (
            SELECT MAX(created_ts)
            FROM (
              SELECT s.created_at AS created_ts FROM app_user_sessions s WHERE s.user_id = u.id
              UNION ALL
              SELECT r.created_at AS created_ts FROM app_user_refresh_sessions r WHERE r.user_id = u.id
            )
          ) AS latest_session_at,
          (
            SELECT MAX(d.updated_at)
            FROM app_user_devices d
            WHERE d.user_id = u.id
          ) AS latest_device_at,
          (
            SELECT COUNT(*)
            FROM notification_items n
            WHERE n.app_user_id = u.id OR (n.target_type = 'user' AND n.target_key = u.id)
          ) AS notification_count,
          (
            SELECT COUNT(*)
            FROM notification_items n
            WHERE (n.app_user_id = u.id OR (n.target_type = 'user' AND n.target_key = u.id))
              AND COALESCE(n.status, 'queued') = 'queued'
          ) AS queued_notification_count
        FROM app_users u
        WHERE u.id = @userId
      `,
    )
    .get(params);
  return adminUserRow(row);
}

export function updateAppUserAdminInDb(db, userId, patch = {}) {
  const existing = db.prepare('SELECT * FROM app_users WHERE id = ?').get(String(userId || ''));
  if (!existing) throw new Error('APP_USER_NOT_FOUND');
  const updates = [];
  const params = [];
  if (typeof patch.active === 'boolean') {
    updates.push('active = ?');
    params.push(patch.active ? 1 : 0);
  }
  if (typeof patch.nickname === 'string') {
    const nickname = cleanText(patch.nickname);
    if (nickname.length < 2) throw new Error('APP_USER_NICKNAME_REQUIRED');
    updates.push('nickname = ?');
    params.push(nickname);
  }
  if (typeof patch.profileImageUrl === 'string') {
    updates.push('profile_image_url = ?');
    params.push(cleanText(patch.profileImageUrl));
  }
  if (updates.length === 0) return getAppUserInDb(db, existing.id);
  const now = nowIso();
  updates.push('updated_at = ?');
  params.push(now, existing.id);
  db.prepare(`UPDATE app_users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  return getAppUserInDb(db, existing.id);
}

export function upsertAppUserDeviceInDb(db, userId, { platform, pushToken, deviceName }) {
  const token = cleanText(pushToken);
  if (!token) throw new Error('APP_USER_DEVICE_TOKEN_REQUIRED');
  const id = crypto.randomUUID();
  const now = nowIso();
  db.prepare(
    `
      INSERT INTO app_user_devices (id, user_id, platform, push_token, device_name, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(user_id, push_token) DO UPDATE SET
        platform = excluded.platform,
        device_name = excluded.device_name,
        active = 1,
        updated_at = excluded.updated_at
    `,
  ).run(id, userId, cleanText(platform), token, cleanText(deviceName), now, now);
  return { pushToken: token, updatedAt: now };
}
