import { queryKysely } from '../kysely/client.mjs';
import { payloadFromRow } from './publicHelpers.mjs';
import { rowToYoutubeItem } from './youtubeRepository.mjs';

/** Approximate `isPendingPushDelivery` using typed columns + payload jsonb (top-level or nested). */
const PENDING_PUSH_SQL = `
  channel = 'push'
  AND lower(trim(COALESCE(NULLIF(payload->>'pushDelivery', ''), payload->'payload'->>'pushDelivery', '')))
    NOT IN ('sending', 'sent', 'skipped', 'none')
  AND (
    (
      status = 'queued'
      AND COALESCE(
        NULLIF(trim(COALESCE(NULLIF(payload->>'pushDelivery', ''), payload->'payload'->>'pushDelivery', '')), ''),
        'pending'
      ) = 'pending'
    )
    OR (
      status = 'published'
      AND trim(COALESCE(NULLIF(payload->>'pushDelivery', ''), payload->'payload'->>'pushDelivery', '')) = 'pending'
    )
  )
`;

function isoOrNull(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Lightweight admin dashboard context: counts + quality aggregates + latest rows.
 * Avoids full-table `listCollectionPayloads` fan-out.
 */
export async function loadAdminDashboardSummaryContext() {
  const [countsResult, qualityResult, latestNewsResult, latestYoutubeResult] = await Promise.all([
    queryKysely(
      `
        SELECT
          (SELECT COUNT(*)::int FROM news_items) AS news,
          (SELECT COUNT(*)::int FROM news_translations) AS news_translations,
          (SELECT COUNT(*)::int FROM disclosures) AS disclosures,
          (SELECT COUNT(*)::int FROM calendar_events) AS calendar,
          (SELECT COUNT(*)::int FROM youtube_videos) AS youtube,
          (SELECT COUNT(*)::int FROM market_quotes) AS market_quotes,
          (SELECT COUNT(*)::int FROM coin_markets) AS coin_markets,
          (SELECT COUNT(*)::int FROM notification_items) AS notifications,
          (SELECT COUNT(*)::int FROM notification_items WHERE ${PENDING_PUSH_SQL}) AS queued_notifications,
          (SELECT MAX(GREATEST(
            published_at,
            fetched_at,
            updated_at
          )) FROM news_items) AS news_latest_at,
          (SELECT MAX(GREATEST(
            filed_at,
            updated_at
          )) FROM disclosures) AS disclosures_latest_at,
          (SELECT MAX(GREATEST(
            event_at,
            updated_at,
            created_at,
            CASE WHEN event_date IS NOT NULL THEN event_date::timestamptz ELSE NULL END
          )) FROM calendar_events) AS calendar_latest_at,
          (SELECT MAX(GREATEST(
            published_at,
            fetched_at,
            updated_at
          )) FROM youtube_videos) AS youtube_latest_at,
          (SELECT MAX(GREATEST(
            quote_time,
            fetched_at,
            updated_at
          )) FROM market_quotes) AS market_quotes_latest_at,
          (SELECT MAX(GREATEST(
            fetched_at,
            updated_at
          )) FROM coin_markets) AS coin_markets_latest_at
      `,
    ),
    queryKysely(
      `
        SELECT
          (SELECT COUNT(DISTINCT NULLIF(TRIM(COALESCE(source_name, provider, '')), ''))::int FROM news_items) AS news_sources,
          (SELECT COUNT(DISTINCT NULLIF(TRIM(COALESCE(provider, '')), ''))::int FROM disclosures) AS disclosure_providers,
          (SELECT COUNT(DISTINCT NULLIF(TRIM(COALESCE(symbol, '')), ''))::int FROM disclosures) AS disclosure_symbols,
          (SELECT COUNT(*)::int FROM calendar_events WHERE event_date >= CURRENT_DATE) AS calendar_future_events,
          (SELECT COUNT(DISTINCT NULLIF(TRIM(COALESCE(channel, '')), ''))::int FROM youtube_videos) AS youtube_channels,
          (SELECT COUNT(DISTINCT NULLIF(TRIM(COALESCE(segment, '')), ''))::int FROM market_quotes) AS quote_segments,
          (SELECT COUNT(DISTINCT NULLIF(TRIM(COALESCE(symbol, '')), ''))::int FROM market_quotes) AS quote_symbols,
          (SELECT COUNT(DISTINCT NULLIF(TRIM(COALESCE(symbol, '')), ''))::int FROM coin_markets) AS coin_symbols
      `,
    ),
    queryKysely(
      `
        SELECT payload, id, category, provider, source_name, published_at
        FROM news_items
        ORDER BY published_at DESC NULLS LAST, position ASC
        LIMIT 20
      `,
    ),
    queryKysely(
      `
        SELECT
          id, position, channel, published_at, fetched_at, updated_at,
          provider, provider_item_id, video_id, topic, title,
          channel_id, channel_handle, description, duration,
          view_count, thumbnail_url, sort_bucket, sort_buckets
        FROM youtube_videos
        ORDER BY published_at DESC NULLS LAST, fetched_at DESC NULLS LAST, id DESC
        LIMIT 20
      `,
    ),
  ]);

  const countsRow = countsResult.rows[0] || {};
  const qualityRow = qualityResult.rows[0] || {};

  const latestNews = latestNewsResult.rows
    .map((row) => {
      const item = payloadFromRow(row) || {};
      return {
        id: item.id || row.id,
        titleOriginal: item.titleOriginal || item.title || '',
        summaryOriginal: item.summaryOriginal || item.summary || '',
        sourceName: item.sourceName || row.source_name || '',
        sourceUrl: item.sourceUrl || '',
        category: item.category || row.category || '',
        provider: item.provider || row.provider || '',
        publishedAt: item.publishedAt || isoOrNull(row.published_at),
        titlePrefix: item.titlePrefix || null,
        titleSuffix: item.titleSuffix || null,
      };
    })
    .filter((item) => item.id);

  const latestYoutube = latestYoutubeResult.rows.map(rowToYoutubeItem).filter(Boolean);

  return {
    counts: {
      news: numberOrZero(countsRow.news),
      newsTranslations: numberOrZero(countsRow.news_translations),
      disclosures: numberOrZero(countsRow.disclosures),
      calendar: numberOrZero(countsRow.calendar),
      youtube: numberOrZero(countsRow.youtube),
      marketQuotes: numberOrZero(countsRow.market_quotes),
      coinMarkets: numberOrZero(countsRow.coin_markets),
      notifications: numberOrZero(countsRow.notifications),
      queuedNotifications: numberOrZero(countsRow.queued_notifications),
    },
    latestAt: {
      news: isoOrNull(countsRow.news_latest_at),
      disclosures: isoOrNull(countsRow.disclosures_latest_at),
      calendar: isoOrNull(countsRow.calendar_latest_at),
      youtube: isoOrNull(countsRow.youtube_latest_at),
      marketQuotes: isoOrNull(countsRow.market_quotes_latest_at),
      coinMarkets: isoOrNull(countsRow.coin_markets_latest_at),
    },
    quality: {
      news: {
        translations: numberOrZero(countsRow.news_translations),
        sources: numberOrZero(qualityRow.news_sources),
      },
      disclosures: {
        providers: numberOrZero(qualityRow.disclosure_providers),
        symbols: numberOrZero(qualityRow.disclosure_symbols),
      },
      calendar: {
        futureEvents: numberOrZero(qualityRow.calendar_future_events),
      },
      youtube: {
        channels: numberOrZero(qualityRow.youtube_channels),
      },
      marketQuotes: {
        segments: numberOrZero(qualityRow.quote_segments),
        symbols: numberOrZero(qualityRow.quote_symbols),
      },
      coinMarkets: {
        symbols: numberOrZero(qualityRow.coin_symbols),
      },
    },
    latestNews,
    latestYoutube,
  };
}
