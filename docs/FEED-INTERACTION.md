# 피드 상호작용 규칙

리스트·피드 화면의 **당겨서 새로고침(PTR)**, **필터·탭 변경**, **새 소식 chip**, **캐시**, **폴링** 규칙이다.

레이아웃·여백·Safe Area는 [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md)를 따른다.  
데이터 캐시 TTL 표는 [AGENTS.md](./AGENTS.md#피드-api-캐시)를 따른다.

코드가 단일 출처(source of truth)이며, 이 문서는 규칙과 패턴을 설명한다.

## 1. 용어

| 용어 | 의미 |
|---|---|
| **PTR** | `ThemedRefreshControl` 당겨서 새로고침 |
| **헤더 탭** | iPhone `SignalHeader` 브랜드 탭 · iPad·wide 웹 전역 헤더 로고 탭 |
| **chip** | `FeedNewContentChip` — 백그라운드 폴링으로 새 항목이 있을 때 리스트 위에 표시 |
| **digest** | 뉴스 `DigestPager` · 공시 `DisclosureDigestSection` (고정 스트립) |
| **scope** | 세그먼트·날짜 등 **독립 데이터 단위** (뉴스·공시 탭의 All/속보/출처·시장·공시유형 필터는 제거) |

## 2. 데이터 로딩 3모드

| 모드 | 트리거 | 캐시 | 스크롤 |
|---|---|---|---|
| **진입·재포커스** | 탭 포커스, 최초 mount | `signalCacheMode()` → `use` | 유지 |
| **필터·탭·날짜 변경** | 세그먼트·필터·날짜 deps 변경 | `use` | **맨 위** (`useScrollToTopOnChange`) |
| **새로고침** | PTR · 헤더 탭 · chip 탭 | `signalCacheMode(true)` → `bypass` | **유지** |

```ts
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';

// 일반 로드
fetchXxx(params, { cacheMode: signalCacheMode() });

// PTR · chip · 헤더 탭
fetchXxx(params, { cacheMode: signalCacheMode(true) });
```

## 3. Pull-to-refresh (PTR)

### DO

- `onRefreshBase` → `load(true)` 또는 `{ refresh: true }`만 호출한다.
- PTR 중 **기존 rows를 유지**하고, fetch 완료 후 한 번에 교체한다.
- `ThemedRefreshControl` + (탭 화면) `useResetRefreshingOnTabBlur(setRefreshing)`을 쓴다.
- wide 웹·iPad는 `useRegisterWebHeaderRefresh(() => void onRefresh())`로 헤더 로고와 연결한다.
- iPhone 탭은 `SignalHeader compact onBrandPress={() => void onRefresh()}`로 PTR과 동일 동작을 연결한다.
- 고정 UI(세그먼트·날짜·digest·OTA·에러)는 스크롤 밖(`topFixed`)에 둔다.

### DON'T

- PTR 시 `scrollTo` / filter용 scroll hook을 호출하지 않는다.
- PTR 시작 시 `setItems([])` · `setHasMore(false)` · pagination 리셋을 하지 않는다.
- `ListHeaderComponent`에 로딩·에러·필터·digest를 넣지 않는다 (PTR 시 헤더 높이 변동).
- 인위적 최소 refresh 지연(`setTimeout` 등)을 두지 않는다.
- 화면별 HTTP 캐시(`listCacheRef` 등)를 중복 구현하지 않는다.

### 참조 구현

| 화면 | 파일 |
|---|---|
| 뉴스 (가장 복잡) | `app/(tabs)/news.tsx` — `load(forceRefresh)`, digest, segment chip |
| 공시 | `app/(tabs)/disclosures.tsx` |
| 마켓 | `app/(tabs)/signal.tsx` |
| 게시판 | `app/(tabs)/board.tsx` |
| 홈 | `components/signal/HomeFocusContent.tsx` |

## 4. 필터·탭·날짜 변경 — 스크롤

```ts
const { ref: listRef } = useScrollToTopOnChange([segment, filter, selectedYmd], {
  resyncDeps: [items],
});
```

- `deps`: 필터·세그먼트·날짜 등 **사용자가 의도적으로 컨텍스트를 바꿀 때**만.
- `resyncDeps`: 필터 변경 직후 리스트 데이터가 도착하면 **한 번 더** 맨 위 (웹 DOM scroll 잔류 대응).
- **pagination(`loadMore`) 중에는 재-scroll 하지 않는다** — `useScrollToTopOnChange`의 `awaitingListResyncRef`에 위임.

웹 추가:

- `scrollResetKey` — 필터 deps를 문자열로 (`WebWheelFlatList` / `WebWheelScrollView`)
- `useWebScrollResetOnKey` — DOM `scrollTop` 강제 리셋
- `useWebFlatListLoadMore` — 뷰포트보다 리스트가 짧을 때 loadMore 보조

## 5. 고정 digest

| 갱신 시점 | 동작 |
|---|---|
| PTR · 헤더 탭 · chip | 리스트와 **동시에** digest API `bypass` |
| 세그먼트·필터·날짜 변경 | 해당 scope digest 재로드 |
| 백그라운드 폴링 | digest **갱신 안 함** — chip만 표시 |

digest-only API 갱신 UI는 두지 않는다. 스트립 **끝 refresh 타일**(`DigestRefreshTail`)은 PTR·헤더 탭과 동일한 `onRefresh` shortcut이다.

적용: **뉴스** (`DigestPager`), **공시** (`DisclosureDigestSection`). 레이아웃 상수는 `constants/digestStripLayout.ts`를 공유한다.

### 가로 스크롤 (자유 스크롤 스트립)

다이제스트는 **페이지·카드 단위 스냅 캐러셀이 아니다**. 카드가 가로 스트립으로 나열되고, 사용자가 드래그·스와이프한 **만큼만** 이동한다 (SaveTicker 등 일반 웹 가로 리스트와 동일한 UX).

| 플랫폼 | 구현 | 스크롤 방식 |
|---|---|---|
| **웹** | `WebHorizontalScrollStrip` → DOM `overflow-x: auto` | 브라우저 관성·트랙패드 가로 스와이프·드래그 |
| **앱** | 동일 컴포넌트 → `ScrollView` horizontal | 손가락 스와이프, `decelerationRate="normal"` + bounce |

공통 컴포넌트: `components/layout/WebHorizontalScrollStrip.tsx`  
웹 CSS: `app/+html.tsx` — `[data-signal-horizontal-carousel="true"]` (스크롤바 숨김, `touch-action: pan-x`)

#### 카드 너비 (peek)

다음 카드가 살짝 보이도록 너비를 잡는다 (`DigestPager` · `DisclosureDigestSection` — `constants/digestStripLayout.ts`):

| 레이아웃 | 조건 | 카드 너비 |
|---|---|---|
| 1열 | iPhone·compact | **컨테이너 전폭** (부모 `topFixed` padding 16과 정렬). 항목 2개 이상이면 카드 너비 = 컨테이너 − **36px peek** 로 다음 카드 노출 |
| 2열 | iPad·wide (`columns={2}`) | (컨테이너 − gap) × **0.48** |

compact 1열은 스트립 `paddingHorizontal: 0` — `topFixed`의 `SCREEN_FIXED_HEADER_PADDING_HORIZONTAL`(16)만 사용.  
하단 여백은 다이제스트 `marginBottom` 없이 `topFixed` `paddingBottom`(12) + `gap`(8)만 따른다.

#### 스트립 끝 refresh

카드 끝에 좁은 refresh 타일(`components/feed/DigestRefreshTail.tsx`)을 둔다. 탭 시 화면 `onRefresh`(PTR·헤더 탭·chip과 동일)를 호출하고 **가로 스트립을 맨 앞으로** 되돌린다. `refreshing` 중에는 스피너로 바뀌고 비활성화된다.

#### wide 여백 (iPad·웹)

다이제스트 `topFixed` 블록은 **`topFixedWide`**(`SCREEN_WIDE_CONTENT_PADDING_TOP` = 12px)를 함께 씁니다.  
`listColumnDigestStrip`에서 `paddingTop: 0`으로 덮어쓰지 않습니다 (`newsStyles.ts`).

#### 출처 보기

카드 **인라인 펼치기**(chevron·카드 탭 확장)는 쓰지 않는다. 출처가 있으면 카드 우측 **「출처」** 버튼 → 하단 시트 `DigestSourcesSheet` (`SelectionFilterSheet`와 동일한 slide-up Modal).

- 컴포넌트: `components/news/DigestSourcesSheet.tsx`
- 뉴스: `DigestPager` · 공시: `DisclosureDigestSection`
- 가로 스크롤 시작 시 열린 시트는 닫는다

#### DO

- 다이제스트 가로 스크롤은 **`WebHorizontalScrollStrip`만** 사용한다.
- 웹에서는 **네이티브 overflow-x**로 두고 브라우저 스크롤 물리를 그대로 쓴다.
- 스크롤 시작 시 펼쳐진 카드는 접는다 (`onScrollBeginDrag` → 출처 시트 닫기).
- 다이제스트는 계속 **`topFixed`** (리스트 `ListHeaderComponent` 금지).

#### DON'T

- **페이지 스냅** (`snapToInterval`, CSS `scroll-snap-type: mandatory`, 루프 클론 페이지)을 쓰지 않는다.
- **점 인디케이터(dots)** · 카드 단위 자동 넘김을 두지 않는다.
- 웹에서 휠을 `preventDefault`로 가로채 **`scrollLeft`를 직접 더하지 않는다** (끊김·눈 fatigue 원인).
- 세로 휠을 가로 스크롤에 억지로 매핑하지 않는다 — 웹은 **가로 드래그·트랙패드 좌우**가 기본.
- 다이제스트 전용 `useWebHorizontalWheelScroll` 같은 휠 훅을 다시 만들지 않는다.

#### 참조 구현

| 화면 | 파일 |
|---|---|
| 뉴스 다이제스트 | `components/news/DigestPager.tsx` |
| 공시 다이제스트 | `components/disclosures/DisclosureDigestSection.tsx` |
| 가로 스트립 셸 | `components/layout/WebHorizontalScrollStrip.tsx` |
| 출처 시트 | `components/news/DigestSourcesSheet.tsx` |
| refresh 타일 | `components/feed/DigestRefreshTail.tsx` |
| wide 2열 마운트 | `components/news/LegacyNewsFeedScreen.tsx` · `app/(tabs)/disclosures.tsx` — `useTwoPane`일 때 `columns={2}` + `topFixedWide` |

#### 안티패턴 (digest 스크롤)

| 증상 | 원인 | 해결 |
|---|---|---|
| 웹에서 좌우 스크롤 안 됨 | RN `ScrollView` + 휠 가로채기 | `WebHorizontalScrollStrip` (overflow-x) |
| 스크롤이 딱딱·카드 단위로만 움직임 | `snapToInterval` / scroll-snap | 자유 스크롤, 스냅 제거 |
| 트랙패드·드래그가 부드럽지 않음 | `scrollLeft += delta` 즉시 반영 | 웹 네이티브 overflow, 휠 훅 제거 |
| wide에서 카드 한 장만 덩그러니 | 카드 너비 = 50% 고정 | 0.48 비율로 다음 카드 peek |

## 6. 새 소식 chip

### UI

- 컴포넌트: `FeedNewContentChip` → `UpdatePromptStrip` / `UpdatePromptCard`
- 위치: **리스트 바로 위** (고정 `topFixed` 아래, 스크롤 밖)
- 스타일: `theme.card` + green 2px 테두리
- OTA 배너(`OtaUpdateBanner`)도 같은 strip/card 셸 사용

### 표시 조건

```tsx
<FeedNewContentChip
  visible={newContentAvailable}
  refreshing={refreshing}
  message={t('feedNewContentAvailable')}
  onPress={() => void onRefresh()}
/>
```

- `visible`: scope별 새 항목 감지
- `refreshing === true`이면 chip 숨김
- 탭/화면 **포커스 중**에만 mount (`useIsFocused`)

### scope별 state (필수)

chip·`latestSeenId`는 **scope마다 독립**이다. 한 scope에서 새로고침해도 다른 scope chip은 유지한다.

| 화면 | scope |
|---|---|
| 뉴스 | `global` · `korea` · `crypto` · `watch` · `video` |
| 공시 | 단일 통합 피드 (종목 deep link 필터만 유지) |
| 마켓 | `us-overnight` · `kr-morning` · `kr-lunch` · `kr-close` (과거 날짜에서는 chip 없음) |
| 알림함 | 단일 inbox (필터 탭별 chip 없음 — 의도) |

패턴:

```ts
const [newContentScopes, setNewContentScopes] = useState(() => new Set<ScopeKey>());
const latestSeenIdByScopeRef = useRef<Partial<Record<ScopeKey, string>>>({});

// load / PTR 완료 시
syncScopeLatestSeen(activeScope, rows[0]?.id);

// PTR 시작 시
clearScopeNewContent(activeScope);

// 폴링 (3분, bypass) — seen id가 있을 때만 비교
if (latestId !== seen) markScopeHasNewContent(scope);
```

### DON'T (chip)

- 전역 `newContentAvailable` boolean 하나로 여러 탭을 공유하지 않는다.
- 폴링으로 리스트·digest를 **자동 갱신하지 않는다** (chip만 표시).
- PTR 직후 상단 “N개 업데이트” notice 배너를 두지 않는다 (chip만).

## 7. 폴링 · 탭 배지

| 경로 | 역할 |
|---|---|
| 화면 내 `setInterval` (~3분) | 포커스/백그라운드 중 scope별 chip |
| `services/feedUnreadBadges.ts` | 탭 아이콘 배지 (뉴스·공시·시장·알림) |
| `services/newsUnreadPreference.ts` · `disclosureUnreadPreference.ts` · `signalUnreadPreference.ts` · `alertsUnreadPreference.ts` | scope별 unread·chip 폴링 |
| `tasks/newsUnreadBackgroundTask.ts` | 백그라운드 배지 갱신 |

- 폴링 API는 항상 `{ cacheMode: 'bypass' }`.
- 해당 탭/화면 **포커스 중**에는 탭 배지를 숨기고 chip으로 대체한다.
- chip 적용 없음: **시세**, **게시판**, **유튜브**, **홈**, **캘린더** (배지·폴링 대상 아님).

## 8. 화면별 준수 현황

| 화면 | PTR | scroll on filter | chip | scope chip | digest 고정 | 비고 |
|---|---|---|---|---|---|---|
| 뉴스 | ✅ | ✅ | ✅ | ✅ 5 segment | ✅ | 참조 구현 |
| 공시 | ✅ | ✅ | ✅ | ✅ us/kr | ✅ | |
| 마켓 | ✅ | ✅ | ✅ | ✅ session | — | 오늘만 chip |
| 알림함 | ✅ | ✅ | ✅ | — 단일 | — | |
| 유튜브 | ✅ | ✅ | — | — | — | |
| 시세 | ✅ | ✅ | — | — | — | |
| 게시판 | ✅ | ✅ | — | — | — | source 필터 |
| 홈 | ✅ | ✅ (날짜) | — | — | — | 대시보드 |
| 캘린더 | ✅ | ✅ | — | — | — | 스택 |

## 9. 새 피드 화면 체크리스트

1. [ ] `signalCacheMode()` / `signalCacheMode(true)` 분리
2. [ ] PTR: rows 유지, scroll 이동 없음
3. [ ] 필터 deps → `useScrollToTopOnChange` + `resyncDeps`
4. [ ] `useResetRefreshingOnTabBlur` (탭)
5. [ ] `ThemedRefreshControl`
6. [ ] iPhone `SignalHeader onBrandPress` = PTR
7. [ ] wide `useRegisterWebHeaderRefresh`
8. [ ] 고정 UI → `topFixed`, digest는 PTR/chip과 동시 갱신
9. [ ] digest 가로 스크롤 → `WebHorizontalScrollStrip` (스냅·휠 훅·dots 금지)
10. [ ] 서브탭 scope가 다르면 chip state도 scope별
11. [ ] 웹: `scrollResetKey` · `useWebFlatListLoadMore` (FlatList)

## 10. 안티패턴 (재발 방지)

| 증상 | 원인 | 해결 |
|---|---|---|
| PTR 중 스크롤이 위로 튐 | refresh 시 scroll hook / list clear | PTR와 필터 scroll 분리 |
| 필터 후 loadMore할 때마다 위로 | `resyncDeps`가 pagination마다 scroll | `awaitingListResyncRef` 패턴 |
| digest가 PTR과 함께 스크롤 | digest를 `ListHeaderComponent`에 배치 | `topFixed`로 이동 |
| digest 웹 가로 스크롤 끊김 | RN ScrollView + 휠 `scrollLeft` 조작 | `WebHorizontalScrollStrip` |
| digest가 카드 단위로만 넘어감 | `snapToInterval` / scroll-snap | 자유 스크롤 스트립 |
| 한 탭 chip 누르면 전 탭 chip 사라짐 | 전역 `newContentAvailable` | scope별 Set |
| 와치리스트에 글로벌 chip | 글로벌만 폴링 | segment별 poll |
| PTR 끊김 | refresh 시작 시 pagination/hasMore 리셋 | `isRefresh` 분기 |
| 탭 복귀 후 스피너 stuck | `refreshing` state 잔류 | `useResetRefreshingOnTabBlur` |

## 11. 관련 파일

| 역할 | 파일 |
|---|---|
| 캐시 모드 | `integrations/signal-api/cacheMode.ts` |
| scroll-to-top | `hooks/useScrollToTopOnChange.ts` |
| tab blur refresh | `hooks/useResetRefreshingOnTabBlur.ts` |
| 웹 scroll reset | `hooks/useWebScrollResetOnKey.ts` |
| 웹 loadMore | `hooks/useWebFlatListLoadMore.ts` |
| wide 헤더 PTR | `contexts/WebHeaderRefreshContext.tsx` |
| PTR UI | `components/signal/ThemedRefreshControl.tsx` |
| chip UI | `components/signal/UpdatePromptStrip.tsx`, `FeedNewContentChip.tsx` |
| digest 가로 스트립 | `components/layout/WebHorizontalScrollStrip.tsx` |
| 뉴스 digest | `components/news/DigestPager.tsx` |
| 공시 digest | `components/disclosures/DisclosureDigestSection.tsx` |
| 탭 배지 | `contexts/FeedUnreadBadgesContext.tsx`, `services/feedUnreadBadges.ts` |
