import type { YoutubeItem } from '@/types/signal';

/**
 * 유튜브 검색 시 경제·매크로 이외 잡음을 줄이기 위한 고정 키워드 풀.
 * YouTube Data API `q`에 동일 키워드 조합 + `videoCategoryId`(뉴스 등) 병행 검토.
 */
export const ECONOMY_SEARCH_BOOST =
  '경제 매크로 미국경제 연준 금리 인플레이션 경기 침체 고용 물가';

export function buildEconomyYoutubeSearchUrl(item: YoutubeItem) {
  const q = `${item.title} ${item.channel} ${ECONOMY_SEARCH_BOOST}`.replace(/\s+/g, ' ').trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

export function youtubeOpenUrl(item: YoutubeItem) {
  if (item.videoId) {
    return `https://www.youtube.com/watch?v=${item.videoId}`;
  }
  return buildEconomyYoutubeSearchUrl(item);
}
