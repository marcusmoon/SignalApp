import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { normalizeDigestRevision } from '../server/src/news/digestRevision.mjs';
import { FOCUS_TARGETS } from '../domain/home/focusUniverse.ts';

// No embedded credentials. Scheduled runs receive this through their environment.
try { process.loadEnvFile(resolve('server/.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const base = process.env.SIGNAL_SERVER_URL || 'https://signalapp.up.railway.app';
const token = process.env.SIGNAL_AUTOMATION_INGEST_TOKEN;
if (!token) throw new Error('SIGNAL_AUTOMATION_INGEST_TOKEN is required');
const directory = resolve(process.env.SIGNAL_DIGEST_WORK_DIR || '/tmp/signal-news-revisions');
const mode = process.argv[2] || 'collect';
async function request(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(30000),
    headers: { 'x-signal-automation-token': token, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(`Signal API ${response.status}: ${path.split('?')[0]}`);
  return response.json();
}
await mkdir(directory, { recursive: true });
if (mode === 'collect') {
  // Capability gate: never send v3 to an old deployment accepting arbitrary fields.
  const context = await request('/v1/news-digests/context');
  if (context.schemaVersion !== 3) throw new Error('Deploy the v3 server before switching the scheduler');
  const to = new Date().toISOString();
  const from = new Date(Date.now() - 14 * 3600000).toISOString();
  const news = {};
  const truncated = {};
  for (const category of ['global', 'korea', 'crypto']) {
    news[category] = [];
    // Bounded pagination avoids silently discarding the older part of the window.
    for (let offset = 0; offset < 300; offset += 100) {
      const page = await request(`/v1/news?${new URLSearchParams({ category, from, to, limit: '100', offset: String(offset), locale: 'ko' })}`);
      news[category].push(...(page.data || []));
      truncated[category] = Boolean(page.meta?.hasMore);
      if (!page.meta?.hasMore) break;
    }
  }
  await writeFile(resolve(directory, 'context.json'), JSON.stringify({ collectedAt: to, from, to, focusTargets: FOCUS_TARGETS, previous: context.data, news, truncated }, null, 2));
  if (Object.values(truncated).some(Boolean)) console.warn('Collection capped; inspect context.truncated before summarizing');
  console.log(`Context ready: ${resolve(directory, 'context.json')}`);
} else if (mode === 'validate' || mode === 'publish') {
  const payload = JSON.parse(await readFile(resolve(directory, 'draft.json'), 'utf8'));
  const context = JSON.parse(await readFile(resolve(directory, 'context.json'), 'utf8'));
  if (payload.schemaVersion !== 3 || !Array.isArray(payload.items) || payload.items.length > 9) throw new Error('Invalid v3 payload');
  const collectedAt = Date.parse(context.collectedAt);
  if (!Number.isFinite(collectedAt) || collectedAt > Date.now() + 300000 || Date.now() - collectedAt > 3600000) throw new Error('Context expired or invalid; collect again');
  const known = new Map(Object.values(context.news).flat().map((item) => [item.id, item]));
  const stories = new Set();
  const evidence = new Set();
  for (const [index, raw] of payload.items.entries()) {
    const item = normalizeDigestRevision(raw, index, new Date().toISOString());
    if (stories.has(item.storyId)) throw new Error('Duplicate story');
    stories.add(item.storyId);
    for (const ref of item.sourceRefs) {
      if (!known.has(ref.id) || evidence.has(ref.id)) throw new Error('Evidence missing from collected news or reused');
      evidence.add(ref.id);
    }
  }
  if (mode === 'publish') {
    const capability = await request('/v1/news-digests/context');
    if (capability.schemaVersion !== 3) throw new Error('v3 server unavailable');
    console.log(JSON.stringify(await request('/v1/news-digests/ingest', payload)));
  } else console.log(`Validated ${payload.items.length} revisions; nothing published`);
} else throw new Error('Use collect, validate, or publish');
