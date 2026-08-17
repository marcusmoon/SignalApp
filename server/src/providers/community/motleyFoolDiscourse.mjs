import { parseToUtcIsoOrNull, utcNowIso } from '../../time/utc.mjs';
import { htmlToPlainText, mapWithConcurrency } from './text.mjs';

const SOURCE = 'motley_fool_investing';
const BASE_URL = 'https://discussion.fool.com';
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; CommunityBot/1.0)',
  Accept: 'application/json',
};

/** Option 2 — Stocks A to Z + Investment Analysis Clubs (subcategories). */
const BOARD_FEEDS = [
  { id: 16, slug: 'stocks-a-to-z' },
  { id: 8, slug: 'investment-analysis-clubs', includeSubcategories: true },
];

function cleanText(value) {
  return String(value || '').trim();
}

function topicUrl(slug, topicId) {
  const id = cleanText(topicId);
  const path = cleanText(slug);
  return id && path ? `${BASE_URL}/t/${path}/${id}` : null;
}

function isMetaTopic(topic) {
  const title = cleanText(topic?.title);
  if (!title) return true;
  if (/^About the .+ category$/i.test(title)) return true;
  if (title === 'Welcome to the New Motley Fool Community') return true;
  return false;
}

async function fetchCategoryTopics(feed, perFeedLimit) {
  const url = new URL(`${BASE_URL}/c/${feed.slug}/${feed.id}/l/latest.json`);
  if (feed.includeSubcategories) {
    url.searchParams.set('include_subcategories', 'true');
  }
  const response = await fetch(url, { headers: FETCH_HEADERS });
  if (!response.ok) {
    throw new Error(`MOTLEY_FOOL_HTTP_${response.status}`);
  }
  const json = await response.json();
  const topics = Array.isArray(json?.topic_list?.topics) ? json.topic_list.topics : [];
  return topics.filter((topic) => !isMetaTopic(topic)).slice(0, perFeedLimit);
}

async function fetchTopicBody(slug, topicId) {
  const id = cleanText(topicId);
  const path = cleanText(slug);
  if (!id || !path) return null;
  const response = await fetch(`${BASE_URL}/t/${path}/${id}.json`, { headers: FETCH_HEADERS });
  if (!response.ok) return null;
  const json = await response.json();
  const post = json?.post_stream?.posts?.[0];
  const html = post?.cooked || '';
  const body = htmlToPlainText(html);
  return body || null;
}

function normalizeRow(topic, bodyOverride) {
  const topicId = cleanText(topic?.id);
  const slug = cleanText(topic?.slug);
  const title = cleanText(topic?.title);
  if (!topicId || !slug || !title) return null;
  const body = cleanText(bodyOverride || topic?.excerpt);
  const publishedAt =
    parseToUtcIsoOrNull(topic?.last_posted_at) ||
    parseToUtcIsoOrNull(topic?.created_at) ||
    utcNowIso();
  const fetchedAt = utcNowIso();
  return {
    id: `community-${SOURCE}-${topicId}`,
    source: SOURCE,
    provider: 'motley_fool',
    providerItemId: topicId,
    title,
    body,
    sourceUrl: topicUrl(slug, topicId),
    publishedAt,
    fetchedAt,
    updatedAt: fetchedAt,
  };
}

export async function fetchMotleyFoolInvestingBoards(options = {}) {
  const pageSize = Math.min(50, Math.max(5, Number(options.pageSize) || 30));
  const perFeedLimit = Math.min(30, Math.max(5, Math.ceil(pageSize / BOARD_FEEDS.length) + 5));

  const merged = new Map();
  for (const feed of BOARD_FEEDS) {
    const topics = await fetchCategoryTopics(feed, perFeedLimit);
    for (const topic of topics) {
      const id = cleanText(topic?.id);
      if (!id || merged.has(id)) continue;
      merged.set(id, topic);
    }
  }

  const sorted = [...merged.values()].sort((a, b) => {
    const aTs = Date.parse(a?.last_posted_at || a?.created_at || '') || 0;
    const bTs = Date.parse(b?.last_posted_at || b?.created_at || '') || 0;
    return bTs - aTs;
  });
  const selected = sorted.slice(0, pageSize);

  const enriched = await mapWithConcurrency(selected, 6, async (topic) => {
    const detailBody = await fetchTopicBody(topic?.slug, topic?.id);
    const excerptBody = htmlToPlainText(topic?.excerpt || '');
    return normalizeRow(topic, detailBody || excerptBody);
  });

  return enriched.filter(Boolean);
}
