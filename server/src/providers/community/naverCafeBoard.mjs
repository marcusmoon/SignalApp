import { parseToUtcIsoOrNull, utcNowIso } from '../../time/utc.mjs';
import { mapWithConcurrency, htmlToPlainText } from './text.mjs';

/**
 * Generic Naver Cafe board list + article body fetch.
 * @param {{
 *   clubId: string | number,
 *   menuId: string | number,
 *   cafeUrl: string,
 *   source: string,
 *   pageSize?: number,
 * }} options
 */
export async function fetchNaverCafeBoard(options = {}) {
  const clubId = String(options.clubId || '').trim();
  const menuId = String(options.menuId || '').trim();
  const cafeUrl = String(options.cafeUrl || '').trim();
  const source = String(options.source || '').trim();
  if (!clubId || !menuId || !cafeUrl || !source) {
    throw new Error('NAVER_CAFE_BOARD_OPTIONS');
  }

  const pageSize = Math.min(50, Math.max(5, Number(options.pageSize) || 30));
  const referer = `https://cafe.naver.com/${cafeUrl}`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; CommunityBot/1.0)',
    Referer: referer,
  };
  const listUrl = new URL(
    `https://apis.naver.com/cafe-web/cafe-boardlist-api/v1/cafes/${clubId}/menus/${menuId}/articles`,
  );
  listUrl.searchParams.set('page', '1');
  listUrl.searchParams.set('pageSize', String(pageSize));
  listUrl.searchParams.set('sortBy', 'TIME');

  const response = await fetch(listUrl, { headers });
  if (!response.ok) {
    throw new Error(`NAVER_CAFE_HTTP_${response.status}`);
  }
  const json = await response.json();
  const items = Array.isArray(json?.result?.articleList) ? json.result.articleList : [];
  const rows = items.map((row) => row?.item).filter(Boolean);

  const detailBase = `https://apis.naver.com/cafe-web/cafe-articleapi/v3/cafes/${clubId}/articles`;

  const enriched = await mapWithConcurrency(rows, 6, async (item) => {
    const detailBody = await fetchNaverArticleBody(detailBase, headers, item?.articleId);
    return normalizeRow({
      item,
      bodyOverride: detailBody || item?.summary,
      clubId,
      source,
    });
  });

  return enriched.filter(Boolean);
}

function cleanText(value) {
  return String(value || '').trim();
}

function articleUrl(clubId, articleId) {
  return `https://m.cafe.naver.com/ca-fe/web/cafes/${clubId}/articles/${articleId}`;
}

function normalizeRow({ item, bodyOverride, clubId, source }) {
  const articleId = cleanText(item?.articleId);
  const title = cleanText(item?.subject);
  if (!articleId || !title) return null;
  // 일부 카페는 목록 summary·상세 본문이 비공개(401) — 제목·링크만 저장
  const body = cleanText(bodyOverride || item?.summary);
  const publishedAt =
    parseToUtcIsoOrNull(item?.writeDateTimestamp ? new Date(Number(item.writeDateTimestamp)).toISOString() : null) ||
    utcNowIso();
  const fetchedAt = utcNowIso();
  return {
    id: `community-${source}-${articleId}`,
    source,
    provider: 'naver_cafe',
    providerItemId: articleId,
    title,
    body,
    sourceUrl: articleUrl(clubId, articleId),
    publishedAt,
    fetchedAt,
    updatedAt: fetchedAt,
  };
}

async function fetchNaverArticleBody(detailBase, headers, articleId) {
  const id = cleanText(articleId);
  if (!id) return null;
  const response = await fetch(`${detailBase}/${encodeURIComponent(id)}`, { headers });
  if (!response.ok) return null;
  const json = await response.json();
  const html = json?.result?.article?.contentHtml || '';
  const body = htmlToPlainText(html);
  return body || null;
}
