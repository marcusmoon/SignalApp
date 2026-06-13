import crypto from 'node:crypto';
import { queryKysely, withKyselyTransaction } from '../kysely/client.mjs';
import { nowIso } from '../time.mjs';
import { cleanText } from './publicHelpers.mjs';

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

function publicAdminUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    active: row.active === true || row.active === 'true',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

async function activeAdminCount(client = null) {
  const runner = client || { query: queryKysely };
  const result = await runner.query('SELECT COUNT(*)::int AS count FROM admin_users WHERE active = true');
  return Number(result.rows[0]?.count) || 0;
}

export async function verifyAdminLoginRow(loginId, password) {
  const id = cleanText(loginId);
  if (!id || !password) return null;
  const result = await queryKysely('SELECT * FROM admin_users WHERE id = $1', [id]);
  const row = result.rows[0];
  if (!row || row.active !== true) return null;
  return verifyPassword(password, row) ? { id: row.id } : null;
}

export async function hasActiveAdminUsers() {
  const result = await queryKysely('SELECT COUNT(*)::int AS count FROM admin_users WHERE active = true');
  return Number(result.rows[0]?.count) > 0;
}

export async function listAdminUserRows() {
  const result = await queryKysely('SELECT * FROM admin_users ORDER BY lower(id)');
  return result.rows.map(publicAdminUser);
}

export async function createAdminUserRow({ id, password, active = true }) {
  const userId = cleanText(id);
  if (!userId) throw new Error('ADMIN_USER_ID_REQUIRED');
  if (!password) throw new Error('ADMIN_USER_PASSWORD_REQUIRED');
  const { hash, salt } = hashPassword(password);
  const now = nowIso();
  try {
    await queryKysely(
      `
        INSERT INTO admin_users (id, password_hash, password_salt, active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $5)
      `,
      [userId, hash, salt, active !== false, now],
    );
  } catch (error) {
    if (String(error?.code) === '23505') throw new Error('ADMIN_USER_EXISTS');
    throw error;
  }
  return { id: userId, active: active !== false, createdAt: now, updatedAt: now };
}

export async function updateAdminUserRow(id, patch = {}) {
  const userId = cleanText(id);
  if (!userId) throw new Error('ADMIN_USER_ID_REQUIRED');
  return withKyselyTransaction(async (client) => {
    const existing = await client.query('SELECT * FROM admin_users WHERE id = $1 FOR UPDATE', [userId]);
    if (!existing.rows[0]) throw new Error('ADMIN_USER_NOT_FOUND');
    if (typeof patch.active === 'boolean' && existing.rows[0].active === true && patch.active === false && (await activeAdminCount(client)) <= 1) {
      throw new Error('ADMIN_USER_LAST_ACTIVE');
    }
    const sets = [];
    const params = [];
    if (typeof patch.active === 'boolean') {
      params.push(patch.active);
      sets.push(`active = $${params.length}`);
    }
    if (typeof patch.password === 'string' && patch.password) {
      const { hash, salt } = hashPassword(patch.password);
      params.push(hash);
      sets.push(`password_hash = $${params.length}`);
      params.push(salt);
      sets.push(`password_salt = $${params.length}`);
    }
    if (sets.length > 0) {
      params.push(nowIso());
      sets.push(`updated_at = $${params.length}`);
      params.push(userId);
      await client.query(`UPDATE admin_users SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    }
    const next = await client.query('SELECT * FROM admin_users WHERE id = $1', [userId]);
    return publicAdminUser(next.rows[0]);
  });
}

export async function deleteAdminUserRow(id) {
  const userId = cleanText(id);
  if (!userId) throw new Error('ADMIN_USER_ID_REQUIRED');
  return withKyselyTransaction(async (client) => {
    const existing = await client.query('SELECT * FROM admin_users WHERE id = $1 FOR UPDATE', [userId]);
    if (!existing.rows[0]) throw new Error('ADMIN_USER_NOT_FOUND');
    if (existing.rows[0].active === true && (await activeAdminCount(client)) <= 1) throw new Error('ADMIN_USER_LAST_ACTIVE');
    await client.query('DELETE FROM admin_users WHERE id = $1', [userId]);
    return { id: userId };
  });
}
