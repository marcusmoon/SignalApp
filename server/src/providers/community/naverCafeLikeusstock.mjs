import { parseToUtcIsoOrNull, utcNowIso } from '../../time/utc.mjs';
import { mapWithConcurrency, stripHtml } from './text.mjs';

const CLUB_ID = '28497937';
const MENU_ID = 5;
const CAFE_REFERER = 'https://cafe.naver.com/likeusstock';
const SOURCE = 'naver_likeusstock_free';
const LIST_URL = `https://apis.naver.com/cafe-web/cafe-boardlist-api/v1/cafes/${CLUB_ID}/menus/${MENU_ID}/articles`;
const DETAIL_URL = `https://apis.naver.com/cafe-web/cafe-articleapi/v3/cafes/${CLUB_ID}/articles`;
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 SIGNAL-CommunityBot/1.0',
  Referer: CAFE_REFERER,
};

function cleanText(value) {
  return String(value || '').trim();
}

function articleUrl(articleId) {
  return `https://m.cafe.naver.com/ca-fe/web/cafes/${CLUB_ID}/articles/${articleId}`;
}

function normalizeRow(item, bodyOverride) {
  const articleId = cleanText(item?.articleId);
  const title = cleanText(item?.subject);
  const body = cleanText(bodyOverride || item?.summary);
  if (!articleId || !title || !body) return null;
  const publishedAt =
    parseToUtcIsoOrNull(item?.writeDateTimestamp ? new Date(Number(item.writeDateTimestamp)).toISOString() : null) ||
    utcNowIso();
  const fetchedAt = utcNowIso();
  return {
    id: `community-${SOURCE}-${articleId}`,
    source: SOURCE,
    provider: 'naver_cafe',
    providerItemId: articleId,
    title,
    body,
    sourceUrl: articleUrl(articleId),
    publishedAt,
    fetchedAt,
    updatedAt: fetchedAt,
  };
}

async function fetchNaverArticleBody(articleId) {
  const id = cleanText(articleId);
  if (!id) return null;
  const response = await fetch(`${DETAIL_URL}/${encodeURIComponent(id)}`, { headers: FETCH_HEADERS });
  if (!response.ok) return null;
  const json = await response.json();
  const html = json?.result?.article?.contentHtml || '';
  const body = stripHtml(html);
  return body || null;
}

export async function fetchNaverCafeLikeusstockFree(options = {}) {
  const pageSize = Math.min(50, Math.max(5, Number(options.pageSize) || 30));
  const url = new URL(LIST_URL);
  url.searchParams.set('page', '1');
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('sortBy', 'TIME');

  const response = await fetch(url, { headers: FETCH_HEADERS });
  if (!response.ok) {
    throw new Error(`NAVER_CAFE_HTTP_${response.status}`);
  }
  const json = await response.json();
  const items = Array.isArray(json?.result?.articleList) ? json.result.articleList : [];
  const rows = items.map((row) => row?.item).filter(Boolean);

  const enriched = await mapWithConcurrency(rows, 6, async (item) => {
    const detailBody = await fetchNaverArticleBody(item?.articleId);
    return normalizeRow(item, detailBody || item?.summary);
  });

  return enriched.filter(Boolean);
}
