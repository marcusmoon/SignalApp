import { parseToUtcIsoOrNull, utcNowIso } from '../../time/utc.mjs';

const SOURCE = 'save_user_news';
const LIST_URL = 'https://api.saveticker.com/api/community/list';

function cleanText(value) {
  return String(value || '').trim();
}

function postUrl(postId) {
  return `https://www.saveticker.com/community/detail/${postId}`;
}

function normalizeRow(post) {
  const postId = cleanText(post?.id);
  const title = cleanText(post?.title);
  const body = cleanText(post?.content);
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

export async function fetchSaveUserNews(options = {}) {
  const pageSize = Math.min(50, Math.max(5, Number(options.pageSize) || 30));
  const url = new URL(LIST_URL);
  url.searchParams.set('category', 'user_news');
  url.searchParams.set('sort', 'created_at_desc');
  url.searchParams.set('page', '1');
  url.searchParams.set('page_size', String(pageSize));

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 SIGNAL-CommunityBot/1.0',
      Origin: 'https://www.saveticker.com',
      Referer: 'https://www.saveticker.com/community',
    },
  });
  if (!response.ok) {
    throw new Error(`SAVE_COMMUNITY_HTTP_${response.status}`);
  }
  const json = await response.json();
  const posts = Array.isArray(json?.posts) ? json.posts : [];
  return posts.map(normalizeRow).filter(Boolean);
}
