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

/** JSON array: [{"id":"...","password":"..."}, ...]. Empty → admin login disabled. */
function parseAdminUsersFromEnv() {
  const raw = String(process.env.ADMIN_USERS || '').trim();
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) {
      console.warn('[config] ADMIN_USERS must be a JSON array; admin login disabled.');
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
    if (!out.length) console.warn('[config] ADMIN_USERS has no valid entries; admin login disabled.');
    return out;
  } catch {
    console.warn('[config] ADMIN_USERS is not valid JSON; admin login disabled.');
    return [];
  }
}

function resolveDataDir() {
  const raw = String(process.env.DATA_DIR || '').trim();
  if (!raw) return path.join(rootDir, 'data');
  // Allow absolute paths (Railway volume mount) or relative paths.
  return path.isAbsolute(raw) ? raw : path.join(rootDir, raw);
}

export const config = {
  rootDir,
  dataDir: resolveDataDir(),
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 4000),
  adminUsers: parseAdminUsersFromEnv(),
  sessionSecret: process.env.SESSION_SECRET || 'change-me-local-session-secret',
  finnhubToken: process.env.FINNHUB_TOKEN || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
  apiNinjasKey: process.env.API_NINJAS_KEY || '',
  translationProvider: process.env.TRANSLATION_PROVIDER || 'mock',
  translationModel: process.env.TRANSLATION_MODEL || 'mock-ko-news-v1',
};
