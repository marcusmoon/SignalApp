import { fetchNaverCafeBoard } from './naverCafeBoard.mjs';

/** 미국 주식이 미래다 (likeusstock) 자유게시판 */
export async function fetchNaverCafeLikeusstockFree(options = {}) {
  return fetchNaverCafeBoard({
    clubId: '28497937',
    menuId: 5,
    cafeUrl: 'likeusstock',
    source: 'naver_likeusstock_free',
    pageSize: options.pageSize,
  });
}
