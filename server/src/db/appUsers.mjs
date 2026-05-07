import crypto from 'node:crypto';
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

export function createAppUserInDb(db, { email, password, nickname, profileImageUrl = '', locale = 'ko', acceptedTerms = [] }) {
  const normalizedEmail = normalizeEmail(email);
  const userPassword = String(password || '');
  const cleanNickname = cleanText(nickname);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('APP_USER_EMAIL_INVALID');
  if (userPassword.length < 8) throw new Error('APP_USER_PASSWORD_TOO_SHORT');
  if (cleanNickname.length < 2) throw new Error('APP_USER_NICKNAME_REQUIRED');
  const exists = db.prepare('SELECT id FROM app_users WHERE email = ?').get(normalizedEmail);
  if (exists) throw new Error('APP_USER_EMAIL_EXISTS');
  const requiredTerms = validateRequiredTermsAcceptedInDb(db, acceptedTerms, locale);
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
  return { user: publicUser(row), session: createSessionInDb(db, id) };
}

export function loginAppUserInDb(db, { email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const row = db.prepare('SELECT * FROM app_users WHERE email = ?').get(normalizedEmail);
  if (!row || Number(row.active) !== 1 || !verifyPassword(password, row)) throw new Error('APP_USER_LOGIN_FAILED');
  return { user: publicUser(row), session: createSessionInDb(db, row.id) };
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
  db.prepare('UPDATE app_user_identities SET disconnected_at = ?, updated_at = ? WHERE id = ?').run(now, now, identity.id);
  return publicIdentity(db.prepare('SELECT * FROM app_user_identities WHERE id = ?').get(identity.id));
}

export function verifyAppUserTokenInDb(db, token) {
  const hash = tokenHash(token);
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

export function revokeAppUserTokenInDb(db, token) {
  const hash = tokenHash(token);
  const now = nowIso();
  db.prepare('UPDATE app_user_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL').run(now, hash);
  return { revokedAt: now };
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
  db.prepare('UPDATE app_users SET active = 0, updated_at = ? WHERE id = ?').run(now, id);
  db.prepare('UPDATE app_user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(now, id);
  db.prepare('UPDATE app_user_devices SET active = 0, updated_at = ? WHERE user_id = ?').run(now, id);
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
            SELECT COUNT(*)
            FROM app_user_sessions s
            WHERE s.user_id = u.id
              AND s.revoked_at IS NULL
              AND s.expires_at > @now
          ) AS active_session_count,
          (
            SELECT COUNT(*)
            FROM app_user_devices d
            WHERE d.user_id = u.id AND d.active = 1
          ) AS device_count,
          (
            SELECT MAX(s.created_at)
            FROM app_user_sessions s
            WHERE s.user_id = u.id
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
            SELECT COUNT(*)
            FROM app_user_sessions s
            WHERE s.user_id = u.id
              AND s.revoked_at IS NULL
              AND s.expires_at > @now
          ) AS active_session_count,
          (
            SELECT COUNT(*)
            FROM app_user_devices d
            WHERE d.user_id = u.id AND d.active = 1
          ) AS device_count,
          (
            SELECT MAX(s.created_at)
            FROM app_user_sessions s
            WHERE s.user_id = u.id
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
