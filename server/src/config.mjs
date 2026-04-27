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

export const config = {
  rootDir,
  dataDir: path.join(rootDir, 'data'),
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 4000),
  adminId: process.env.ADMIN_ID || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'signal-local',
  sessionSecret: process.env.SESSION_SECRET || 'change-me-local-session-secret',
  finnhubToken: process.env.FINNHUB_TOKEN || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
  translationProvider: process.env.TRANSLATION_PROVIDER || 'mock',
  translationModel: process.env.TRANSLATION_MODEL || 'mock-ko-news-v1',
};
