import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function loadDotEnv() {
  const file = path.join(rootDir, '.env');
  if (!fs.existsSync(file)) return;
  const body = fs.readFileSync(file, 'utf8');
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (process.env[key] == null) process.env[key] = value;
  }
}

loadDotEnv();

/** Initial SQLite admin seed: [{"id":"...","password":"..."}]. Used only when admin_users is empty. */
function parseAdminUsersFromEnv() {
  const raw = String(process.env.ADMIN_USERS || '').trim();
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) {
      console.warn('[config] ADMIN_USERS must be a JSON array; admin seed skipped.');
      return [];
    }
    const out = [];
    for (const row of arr) {
      if (!row || typeof row !== 'object') continue;
      const id = String(row.id || row.loginId || '').trim();
      const password = String(row.password || '').trim();
      if (!id || !password) continue;
      out.push({ id, password });
    }
    if (!out.length) console.warn('[config] ADMIN_USERS has no valid entries; admin seed skipped.');
    return out;
  } catch {
    console.warn('[config] ADMIN_USERS is not valid JSON; admin seed skipped.');
    return [];
  }
}

function resolveDataDir() {
  const raw = String(process.env.DATA_DIR || '').trim();
  if (!raw) return path.join(rootDir, 'data');
  // Allow absolute paths (Railway volume mount) or relative paths.
  return path.isAbsolute(raw) ? raw : path.join(rootDir, raw);
}

const dataDir = resolveDataDir();

function resolveSqlitePath() {
  const raw = String(process.env.SQLITE_DB_PATH || '').trim();
  if (!raw) return path.join(dataDir, 'signal.sqlite');
  // Allow absolute paths (Railway volume mount) or relative paths.
  return path.isAbsolute(raw) ? raw : path.join(rootDir, raw);
}

function boolEnv(name, defaultValue) {
  const raw = process.env[name];
  if (raw == null || raw === '') return defaultValue;
  const value = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  return defaultValue;
}

export const config = {
  rootDir,
  dataDir,
  sqlitePath: resolveSqlitePath(),
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 4000),
  schedulerEnabled: boolEnv('SIGNAL_SCHEDULER_ENABLED', true),
  slowRequestMs: Number(process.env.SIGNAL_SLOW_REQUEST_MS || 1200),
  verySlowRequestMs: Number(process.env.SIGNAL_VERY_SLOW_REQUEST_MS || 5000),
  jobLockTtlMs: Number(process.env.SIGNAL_JOB_LOCK_TTL_MS || 2 * 60 * 60 * 1000),
  /** RS256 app user access tokens (issuer/audience must match verification). */
  jwtIssuer: String(process.env.SIGNAL_JWT_ISSUER || 'signal-api').trim() || 'signal-api',
  jwtAudience: String(process.env.SIGNAL_JWT_AUDIENCE || 'signal-app').trim() || 'signal-app',
  jwtAccessTtlSeconds: Math.min(Math.max(Number(process.env.SIGNAL_JWT_ACCESS_TTL_SEC || 3600) || 3600, 60), 24 * 60 * 60),
  jwtRefreshTtlDays: Math.min(Math.max(Number(process.env.SIGNAL_JWT_REFRESH_TTL_DAYS || 90) || 90, 1), 365),
  adminUsers: parseAdminUsersFromEnv(),
  sessionSecret: process.env.SESSION_SECRET || 'change-me-local-session-secret',
  finnhubToken: process.env.FINNHUB_TOKEN || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
  ninjasKey: process.env.NINJAS_KEY || '',
  translationProvider: process.env.TRANSLATION_PROVIDER || 'mock',
  translationModel: process.env.TRANSLATION_MODEL || 'mock-ko-news-v1',
};
