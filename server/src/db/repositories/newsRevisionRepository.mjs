import { withKyselyTransaction, queryKysely } from '../kysely/client.mjs';
import { DigestContractError, normalizeDigestRevision, validateDigestPredecessor } from '../../news/digestRevision.mjs';

export async function queryNewsRevisionContext() {
  const result = await queryKysely(`
    SELECT payload FROM (SELECT DISTINCT ON (payload->>'storyId') payload, generated_at
    FROM news_digest_items
    WHERE payload->>'storyId' IS NOT NULL AND generated_at >= now() - interval '7 days'
    ORDER BY payload->>'storyId', generated_at DESC, (payload->>'revisionNumber')::int DESC NULLS LAST, id DESC
    ) latest ORDER BY generated_at DESC
    LIMIT 150
  `);
  return result.rows.map(({ payload }) => ({
    id: payload.id, storyId: payload.storyId, category: payload.category,
    revisionId: payload.revisionId, title: payload.title, summary: payload.summary,
    changes: payload.changes, symbols: payload.symbols, sourceRefs: payload.sourceRefs,
    generatedAt: payload.generatedAt,
  }));
}

export async function ingestNewsRevisions(rawItems, now) {
  if (!Array.isArray(rawItems) || rawItems.length > 9) throw new DigestContractError('MAX_NINE_ITEMS');
  const items = rawItems.map((item, index) => normalizeDigestRevision(item, index, now));
  if (new Set(items.map((item) => item.storyId)).size !== items.length) throw new DigestContractError('DUPLICATE_STORY');
  const sourceIds = items.flatMap((item) => item.sourceRefs.map((ref) => ref.id));
  if (new Set(sourceIds).size !== sourceIds.length) throw new DigestContractError('REUSED_NEWS_EVIDENCE');
  return withKyselyTransaction(async ({ query }) => {
    // Sort locks to prevent concurrent category runs from deadlocking.
    for (const story of items.map((item) => item.storyId).sort()) {
      await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`news-story:${story}`]);
    }
    const evidence = await query('SELECT id FROM news_items WHERE id = ANY($1::text[])', [sourceIds]);
    const availableEvidence = new Set(evidence.rows.map((row) => row.id));
    const stored = [];
    let inserted = 0;
    for (const item of items) {
      const replay = await query('SELECT payload FROM news_digest_items WHERE id = $1', [item.id]);
      if (replay.rows.length) {
        stored.push(replay.rows[0].payload);
        continue;
      }
      if (item.sourceRefs.some((ref) => !availableEvidence.has(ref.id))) throw new DigestContractError('NEWS_EVIDENCE_NOT_FOUND');
      const previous = await query(`SELECT payload FROM news_digest_items
        WHERE payload->>'storyId' = $1 ORDER BY generated_at DESC, (payload->>'revisionNumber')::int DESC NULLS LAST, id DESC LIMIT 1`, [item.storyId]);
      validateDigestPredecessor(item, previous.rows[0]?.payload);
      item.revisionNumber = (Number(previous.rows[0]?.payload?.revisionNumber) || 0) + 1;
      await query(`INSERT INTO news_digest_items
        (id, position, category, digest_date, generated_at, score, payload, updated_at)
        VALUES ($1, $2, $3, $4::date, $5::timestamptz, $6, $7::jsonb, $8::timestamptz)`,
      [item.id, inserted, item.category, item.generatedDate, item.generatedAt, item.score, JSON.stringify(item), now]);
      inserted += 1;
      stored.push(item);
    }
    return { items: stored, inserted };
  });
}
