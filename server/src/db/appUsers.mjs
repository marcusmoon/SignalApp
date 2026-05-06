import crypto from 'node:crypto';
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

export function createAppUserInDb(db, { email, password, nickname, profileImageUrl = '' }) {
  const normalizedEmail = normalizeEmail(email);
  const userPassword = String(password || '');
  const cleanNickname = cleanText(nickname);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('APP_USER_EMAIL_INVALID');
  if (userPassword.length < 8) throw new Error('APP_USER_PASSWORD_TOO_SHORT');
  if (cleanNickname.length < 2) throw new Error('APP_USER_NICKNAME_REQUIRED');
  const exists = db.prepare('SELECT id FROM app_users WHERE email = ?').get(normalizedEmail);
  if (exists) throw new Error('APP_USER_EMAIL_EXISTS');
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
  const row = db.prepare('SELECT * FROM app_users WHERE id = ?').get(id);
  return { user: publicUser(row), session: createSessionInDb(db, id) };
}

export function loginAppUserInDb(db, { email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const row = db.prepare('SELECT * FROM app_users WHERE email = ?').get(normalizedEmail);
  if (!row || Number(row.active) !== 1 || !verifyPassword(password, row)) throw new Error('APP_USER_LOGIN_FAILED');
  return { user: publicUser(row), session: createSessionInDb(db, row.id) };
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
