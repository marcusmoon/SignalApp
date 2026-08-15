import { fetchNaverCafeBoard } from './naverCafeBoard.mjs';

/** 미국주식에 미치다. 미주미 (yamizal) 자유게시판 */
export async function fetchNaverCafeYamizalFree(options = {}) {
  return fetchNaverCafeBoard({
    clubId: '30676048',
    menuId: 14,
    cafeUrl: 'yamizal',
    source: 'naver_yamizal_free',
    pageSize: options.pageSize,
  });
}
