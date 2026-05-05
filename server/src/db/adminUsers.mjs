import crypto from 'node:crypto';
import { config } from '../config.mjs';
import { nowIso } from './time.mjs';

let adminUsersSeedChecked = false;

function hashAdminPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { hash, salt };
}

function verifyAdminPassword(password, row) {
  if (!row?.password_hash || !row?.password_salt) return false;
  const { hash } = hashAdminPassword(password, row.password_salt);
  const saved = Buffer.from(String(row.password_hash), 'hex');
  const candidate = Buffer.from(hash, 'hex');
  return saved.length === candidate.length && crypto.timingSafeEqual(saved, candidate);
}

export function seedAdminUsersFromEnvIfEmpty(db) {
  if (adminUsersSeedChecked) return;
  adminUsersSeedChecked = true;
  const count = db.prepare('SELECT COUNT(*) AS count FROM admin_users').get()?.count || 0;
  if (count > 0) return;
  const users = Array.isArray(config.adminUsers) ? config.adminUsers : [];
  if (users.length === 0) return;

  const now = nowIso();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO admin_users (id, password_hash, password_salt, active, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?)
  `);
  let inserted = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const user of users) {
      const id = String(user?.id || '').trim();
      const password = String(user?.password || '');
      if (!id || !password) continue;
      const { hash, salt } = hashAdminPassword(password);
      const result = stmt.run(id, hash, salt, now, now);
      inserted += Number(result.changes) || 0;
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  if (inserted > 0) console.log(`[db] seeded ${inserted} admin user(s) into SQLite`);
}

export function verifyAdminLoginInDb(db, loginId, password) {
  const id = String(loginId || '').trim();
  if (!id || !password) return null;
  const row = db
    .prepare('SELECT id, password_hash, password_salt, active FROM admin_users WHERE id = ?')
    .get(id);
  if (!row || Number(row.active) !== 1) return null;
  return verifyAdminPassword(password, row) ? { id: row.id } : null;
}

export function hasAdminUsersInDb(db) {
  const count = db.prepare('SELECT COUNT(*) AS count FROM admin_users WHERE active = 1').get()?.count || 0;
  return count > 0;
}

export function listAdminUsersInDb(db) {
  return db
    .prepare(
      `
        SELECT id, active, created_at AS createdAt, updated_at AS updatedAt
        FROM admin_users
        ORDER BY id COLLATE NOCASE
      `,
    )
    .all()
    .map((row) => ({
      id: row.id,
      active: Number(row.active) === 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
}

function activeAdminCount(db) {
  return Number(db.prepare('SELECT COUNT(*) AS count FROM admin_users WHERE active = 1').get()?.count) || 0;
}

export function createAdminUserInDb(db, { id, password, active = true }) {
  const userId = String(id || '').trim();
  const userPassword = String(password || '');
  if (!userId) throw new Error('ADMIN_USER_ID_REQUIRED');
  if (!userPassword) throw new Error('ADMIN_USER_PASSWORD_REQUIRED');
  const exists = db.prepare('SELECT id FROM admin_users WHERE id = ?').get(userId);
  if (exists) throw new Error('ADMIN_USER_EXISTS');
  const { hash, salt } = hashAdminPassword(userPassword);
  const now = nowIso();
  db.prepare(
    `
      INSERT INTO admin_users (id, password_hash, password_salt, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
  ).run(userId, hash, salt, active === false ? 0 : 1, now, now);
  return { id: userId, active: active !== false, createdAt: now, updatedAt: now };
}

export function updateAdminUserInDb(db, id, patch = {}) {
  const userId = String(id || '').trim();
  if (!userId) throw new Error('ADMIN_USER_ID_REQUIRED');
  const existing = db.prepare('SELECT id, active FROM admin_users WHERE id = ?').get(userId);
  if (!existing) throw new Error('ADMIN_USER_NOT_FOUND');
  const updates = [];
  const params = [];
  if (typeof patch.active === 'boolean') {
    if (Number(existing.active) === 1 && patch.active === false && activeAdminCount(db) <= 1) {
      throw new Error('ADMIN_USER_LAST_ACTIVE');
    }
    updates.push('active = ?');
    params.push(patch.active ? 1 : 0);
  }
  if (typeof patch.password === 'string' && patch.password.length > 0) {
    const { hash, salt } = hashAdminPassword(patch.password);
    updates.push('password_hash = ?', 'password_salt = ?');
    params.push(hash, salt);
  }
  if (updates.length === 0) return listAdminUsersInDb(db).find((user) => user.id === userId) || null;
  const now = nowIso();
  updates.push('updated_at = ?');
  params.push(now, userId);
  db.prepare(`UPDATE admin_users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  return listAdminUsersInDb(db).find((user) => user.id === userId) || null;
}

export function deleteAdminUserInDb(db, id) {
  const userId = String(id || '').trim();
  if (!userId) throw new Error('ADMIN_USER_ID_REQUIRED');
  const existing = db.prepare('SELECT id, active FROM admin_users WHERE id = ?').get(userId);
  if (!existing) throw new Error('ADMIN_USER_NOT_FOUND');
  if (Number(existing.active) === 1 && activeAdminCount(db) <= 1) throw new Error('ADMIN_USER_LAST_ACTIVE');
  db.prepare('DELETE FROM admin_users WHERE id = ?').run(userId);
  return { id: userId };
}
