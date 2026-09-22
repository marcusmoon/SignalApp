import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
mock.module('../kysely/client.mjs', { namedExports: {
  queryKysely: (sql, params) => db.query(sql, params),
  withKyselyTransaction: (fn) => db.transaction((trx) => fn({ query: (sql, params) => trx.query(sql, params) })),
} });
mock.module('../../sources/resolveSourceRefs.mjs', { namedExports: {
  hydrateNewsDigestItems: async (rows) => rows,
} });
const { ingestNewsRevisions, queryNewsRevisionContext } = await import('./newsRevisionRepository.mjs');
const { queryPublicNewsDigestRows } = await import('./newsDigestRepository.mjs');
after(() => db.close());

test('revision transaction, retry, evidence, predecessor, history and symbol queries', async () => {
  await db.exec(`CREATE TABLE news_items(id text PRIMARY KEY);
    CREATE TABLE news_digest_items(id text PRIMARY KEY, position integer NOT NULL DEFAULT 0,
      category text, digest_date date, generated_at timestamptz, score numeric, payload jsonb NOT NULL, updated_at timestamptz NOT NULL);
    INSERT INTO news_items VALUES ('n1'), ('n2'), ('n3');`);
  await db.exec(await readFile(new URL('../../../db/migrations/postgres/V21__news_revision_lookup.sql', import.meta.url), 'utf8'));
  const now = new Date().toISOString();
  const raw = { storyId: 'global:nvda:guidance:q3', category: 'global', changeType: 'new', title: 'Guidance', summary: 'Initial announcement',
    generatedAt: now, symbols: ['NVDA'], sourceRefs: [{ type: 'news', id: 'n1', relation: 'primary' }], changes: [{ text: 'Announced', sourceIds: ['n1'] }] };
  const first = await ingestNewsRevisions([raw], now);
  assert.equal(first.inserted, 1);
  const retry = await ingestNewsRevisions([{ ...raw, generatedAt: new Date(Date.now() + 1000).toISOString() }], now);
  assert.equal(retry.inserted, 0);
  assert.equal(retry.items[0].generatedAt, first.items[0].generatedAt);
  const nextRaw = { ...raw, changeType: 'update', previousDigestId: first.items[0].id, summary: 'Confirmed with a new figure',
    sourceRefs: [{ type: 'news', id: 'n2', relation: 'primary' }], changes: [{ text: 'Confirmed', sourceIds: ['n2'] }] };
  const next = await ingestNewsRevisions([nextRaw], now);
  assert.equal(next.items[0].revisionNumber, 2);
  await assert.rejects(ingestNewsRevisions([{ ...nextRaw, summary: 'Stale branch' }], now), /STORY_CHANGED/);
  const korea = { ...raw, storyId: 'korea:samsung:earnings:q3', category: 'korea', symbols: ['005930.KS'],
    sourceRefs: [{ type: 'news', id: 'n3', relation: 'primary' }], changes: [{ text: 'Reported', sourceIds: ['n3'] }] };
  await ingestNewsRevisions([korea], now);
  const missing = { ...raw, storyId: 'global:missing:evidence', sourceRefs: [{ type: 'news', id: 'bad', relation: 'primary' }], changes: [{ text: 'Not collected', sourceIds: ['bad'] }] };
  await assert.rejects(ingestNewsRevisions([{ ...raw, storyId: 'global:rollback:test' }, missing], now), /EVIDENCE_NOT_FOUND/);
  assert.equal((await db.query("SELECT count(*)::int n FROM news_digest_items WHERE payload->>'storyId'='global:rollback:test'")).rows[0].n, 0);
  const all = await queryPublicNewsDigestRows({ limit: 10 });
  assert.equal(all.rows.length, 2);
  assert.equal(all.rows.find((item) => item.storyId === raw.storyId).id, next.items[0].id);
  assert.equal((await queryPublicNewsDigestRows({ symbols: 'KRX:005930' })).rows[0].category, 'korea');
  assert.equal((await queryPublicNewsDigestRows({ symbols: 'NVDA' })).rows.length, 1);
  assert.equal((await queryPublicNewsDigestRows({ symbols: "NVDA') OR TRUE--" })).rows.length, 0);
  assert.equal((await queryPublicNewsDigestRows({ storyId: raw.storyId })).rows.length, 2);
  assert.equal((await queryPublicNewsDigestRows({ id: first.items[0].id })).rows[0].summary, raw.summary);
  const context = await queryNewsRevisionContext();
  assert.equal(context.length, 2);
  assert.equal(context.find((item) => item.storyId === raw.storyId).id, next.items[0].id);
  const page = await queryPublicNewsDigestRows({ limit: 1 });
  assert.equal(page.hasMore, true);
  assert.equal((await queryPublicNewsDigestRows({ limit: 1, offset: page.nextOffset })).rows.length, 1);
  await db.exec("DELETE FROM news_items WHERE id='n1'");
  assert.equal((await ingestNewsRevisions([raw], now)).inserted, 0);
});
