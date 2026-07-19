/**
 * Wide 사이드바 서브탭 회귀 — 선택 하이라이트 유실·탭 전환 clear 경합.
 * 실행: `npm test`
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  INITIAL_SIDEBAR_SUB_TABS_STATE,
  reduceSidebarSubTabs,
  type SidebarSubTabDef,
} from './subTabsState.ts';

const QUOTE_TABS: SidebarSubTabDef[] = [
  { key: 'watch', label: '관심' },
  { key: 'coin', label: '코인' },
];

const NEWS_TABS: SidebarSubTabDef[] = [
  { key: 'global', label: '글로벌' },
  { key: 'korea', label: '한국' },
];

describe('reduceSidebarSubTabs', () => {
  it('setTabs with activeKey sets list and selection together', () => {
    const next = reduceSidebarSubTabs(INITIAL_SIDEBAR_SUB_TABS_STATE, {
      type: 'setTabs',
      owner: 'quotes',
      tabs: QUOTE_TABS,
      activeKey: 'coin',
    });
    assert.equal(next.owner, 'quotes');
    assert.equal(next.activeKey, 'coin');
    assert.equal(next.tabs.length, 2);
  });

  it('simulates segment re-register after clear without losing selection', () => {
    // 클릭 → 선택 → (잘못된 cleanup clear) → 재등록. 예전엔 setActive가 owner null에서 no-op.
    let state = reduceSidebarSubTabs(INITIAL_SIDEBAR_SUB_TABS_STATE, {
      type: 'setTabs',
      owner: 'quotes',
      tabs: QUOTE_TABS,
      activeKey: 'watch',
    });
    state = reduceSidebarSubTabs(state, { type: 'setActive', owner: 'quotes', key: 'coin' });
    assert.equal(state.activeKey, 'coin');

    // effect cleanup clear (세그먼트 변경 시 하면 안 되지만, 발생해도 복구 가능해야 함)
    state = reduceSidebarSubTabs(state, { type: 'clear', owner: 'quotes' });
    assert.equal(state.owner, null);
    assert.equal(state.activeKey, null);

    // 원자 재등록 — 하이라이트 복구
    state = reduceSidebarSubTabs(state, {
      type: 'setTabs',
      owner: 'quotes',
      tabs: QUOTE_TABS,
      activeKey: 'coin',
    });
    assert.equal(state.activeKey, 'coin');
    assert.equal(state.owner, 'quotes');
  });

  it('setActive after clear claims owner (regression: was no-op)', () => {
    let state = reduceSidebarSubTabs(INITIAL_SIDEBAR_SUB_TABS_STATE, {
      type: 'setTabs',
      owner: 'board',
      tabs: [
        { key: 'all', label: '전체' },
        { key: 'save_user_news', label: '세이브' },
      ],
      activeKey: 'all',
    });
    state = reduceSidebarSubTabs(state, { type: 'clear', owner: 'board' });
    state = reduceSidebarSubTabs(state, {
      type: 'setActive',
      owner: 'board',
      key: 'save_user_news',
    });
    assert.equal(state.owner, 'board');
    assert.equal(state.activeKey, 'save_user_news');
  });

  it('clear from previous tab does not wipe the next tab submenu', () => {
    let state = reduceSidebarSubTabs(INITIAL_SIDEBAR_SUB_TABS_STATE, {
      type: 'setTabs',
      owner: 'news',
      tabs: NEWS_TABS,
      activeKey: 'global',
    });
    // 뉴스 → 시세 전환: 시세가 먼저 등록된 뒤 뉴스 blur clear
    state = reduceSidebarSubTabs(state, {
      type: 'setTabs',
      owner: 'quotes',
      tabs: QUOTE_TABS,
      activeKey: 'watch',
    });
    state = reduceSidebarSubTabs(state, { type: 'clear', owner: 'news' });
    assert.equal(state.owner, 'quotes');
    assert.equal(state.activeKey, 'watch');
    assert.equal(state.tabs[0]?.key, 'watch');
  });

  it('setActive from another owner is ignored', () => {
    let state = reduceSidebarSubTabs(INITIAL_SIDEBAR_SUB_TABS_STATE, {
      type: 'setTabs',
      owner: 'quotes',
      tabs: QUOTE_TABS,
      activeKey: 'watch',
    });
    state = reduceSidebarSubTabs(state, {
      type: 'setActive',
      owner: 'news',
      key: 'korea',
    });
    assert.equal(state.owner, 'quotes');
    assert.equal(state.activeKey, 'watch');
  });

  it('setTabs without activeKey preserves prior selection', () => {
    let state = reduceSidebarSubTabs(INITIAL_SIDEBAR_SUB_TABS_STATE, {
      type: 'setTabs',
      owner: 'quotes',
      tabs: QUOTE_TABS,
      activeKey: 'coin',
    });
    state = reduceSidebarSubTabs(state, {
      type: 'setTabs',
      owner: 'quotes',
      tabs: QUOTE_TABS,
    });
    assert.equal(state.activeKey, 'coin');
  });
});
