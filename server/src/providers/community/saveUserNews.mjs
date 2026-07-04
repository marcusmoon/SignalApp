import { parseToUtcIsoOrNull, utcNowIso } from '../../time/utc.mjs';
import { mapWithConcurrency, saveDetailBody } from './text.mjs';

const SOURCE = 'save_user_news';
const LIST_URL = 'https://api.saveticker.com/api/community/list';
const DETAIL_URL = 'https://api.saveticker.com/api/community/detail';
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; CommunityBot/1.0)',
  Origin: 'https://www.saveticker.com',
  Referer: 'https://www.saveticker.com/community',
};

function cleanText(value) {
  return String(value || '').trim();
}

function postUrl(postId) {
  return `https://www.saveticker.com/community/${postId}`;
}

function normalizeRow(post, bodyOverride) {
  const postId = cleanText(post?.id);
  const title = cleanText(post?.title);
  const body = cleanText(bodyOverride || post?.content);
  if (!postId || !title || !body) return null;
  const publishedAt = parseToUtcIsoOrNull(post?.created_at) || utcNowIso();
  const fetchedAt = utcNowIso();
  return {
    id: `community-${SOURCE}-${postId}`,
    source: SOURCE,
    provider: 'save',
    providerItemId: postId,
    title,
    body,
    sourceUrl: postUrl(postId),
    publishedAt,
    fetchedAt,
    updatedAt: fetchedAt,
  };
}

async function fetchSavePostDetail(postId) {
  const id = cleanText(postId);
  if (!id) return null;
  const response = await fetch(`${DETAIL_URL}/${encodeURIComponent(id)}`, { headers: FETCH_HEADERS });
  if (!response.ok) return null;
  const json = await response.json();
  const body = saveDetailBody(json?.post);
  return body || null;
}

export async function fetchSaveUserNews(options = {}) {
  const pageSize = Math.min(50, Math.max(5, Number(options.pageSize) || 30));
  const url = new URL(LIST_URL);
  url.searchParams.set('category', 'user_news');
  url.searchParams.set('sort', 'created_at_desc');
  url.searchParams.set('page', '1');
  url.searchParams.set('page_size', String(pageSize));

  const response = await fetch(url, { headers: FETCH_HEADERS });
  if (!response.ok) {
    throw new Error(`SAVE_COMMUNITY_HTTP_${response.status}`);
  }
  const json = await response.json();
  const posts = Array.isArray(json?.posts) ? json.posts : [];

  const enriched = await mapWithConcurrency(posts, 8, async (post) => {
    const detailBody = await fetchSavePostDetail(post?.id);
    return normalizeRow(post, detailBody || post?.content);
  });

  return enriched.filter(Boolean);
}
