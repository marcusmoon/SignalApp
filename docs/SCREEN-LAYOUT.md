# 화면 레이아웃 기준

앱 화면의 Safe Area, 헤더, 여백, 스크롤 하단 패딩은 **`constants/screenLayout.ts`** 와 이 문서를 기준으로 맞춘다. UI 원칙·테마·컴포넌트 개요는 [DESIGN-GUIDE.md](./DESIGN-GUIDE.md), 다른 앱에 같은 기준을 쓸 때는 [APP-UI-PLAYBOOK.md](./APP-UI-PLAYBOOK.md)를 본다.

구현 상수·헬퍼는 코드가 단일 출처(source of truth)이며, 이 문서는 규칙과 패턴을 설명한다.

**Comfortable density:** 전역 여유 밀도는 `constants/comfortDensity.ts` + `screenLayout.ts` 상수로 적용한다.

**Corner radius:** 덜 둥근 모서리는 `constants/uiCornerRadius.ts`로 적용한다. pill 칩(`999`)·아주 작은 radius는 유지한다.

## 반응형 모드

`useResponsiveLayout()` (`hooks/useResponsiveLayout.ts`):

| 모드 | 조건 | `useTwoPane` |
|---|---|---|
| compact | 너비 < 768 | false |
| regular | 768 ≤ 너비 < 900 (웹·iPhone) | false |
| wide | **네이티브 iPad** (항상) 또는 **웹** 너비 ≥ 900 | true |

- **iPhone**: compact / regular — 하단 플로팅 탭바, 탭마다 `SignalHeader compact`.
- **iPad**: 세로·가로 모두 wide — 좌측 `SignalSidebarTabBar`·상단 `SignalHeader`는 `WideWebShell`에서 **고정 1회**. 우측 pane만 페이지가 바뀐다 (홈·내 정보 드릴인도 전체 Stack 전환 금지).
- **넓은 웹** (≥900): iPad와 동일. 좁은 웹은 iPhone과 동일.
- **Wide URL 동기화**: 홈·내 정보·설정·뉴스 이슈·공시 플로우·유튜브 정렬 등은 `IpadSidebarNavContext`가 **실제 라우트**로 맞춘다 (`useGlobalSearchParams`). 화면 안 필터·날짜도 쿼리에 기본값까지 명시한다. 사이드바 서브탭은 owner 단위로 clear해 탭 전환 경합으로 메뉴가 사라지지 않게 한다.

콘텐츠 최대 폭: `APP_CONTENT_MAX_WIDTH` (720).  
wide 탭·홈·뉴스 플로우·공시 플로우·게시판 등은 `wideContentFill`로 **우측 pane 전체**. 일부 임베디드 상세(오늘의 브리핑 등)만 `APP_WIDE_CONTENT_MAX_WIDTH` (1120).  
가로 inset: `APP_CONTENT_SIDE_PADDING` (16).

## Safe Area `edges`

| 화면 유형 | iPhone | iPad / wide |
|---|---|---|
| 탭 화면 | `['top']` | `[]` (부모 `IpadWideTabLayout`이 top 처리) |
| 스택 화면 | `['bottom']` (Expo Stack 헤더가 top) | `IpadSidebarScreen` 또는 임베디드 pane |
| 설정 | `[]` | 임베디드 / `IpadSidebarScreen` |

예외는 코드 주석과 함께만 허용한다.

## 세로 여백 (공통 상수)

| 상수 | px | 용도 |
|---|---:|---|
| `SCREEN_HEADER_CONTENT_GAP` | 12 | `SignalHeader` 아래 → 날짜 바·세그먼트 등 **첫 고정 UI** |
| `SCREEN_FIXED_HEADER_PADDING_TOP` | 12 | `topFixed` 블록 상단 (=`HEADER_CONTENT_GAP`) |
| `SCREEN_FIXED_HEADER_PADDING_BOTTOM` | 16 | `topFixed` 블록 하단 (단일 스트립) |
| `SCREEN_FIXED_DIGEST_PADDING_BOTTOM` | 0 | 다이제스트 슬롯 하단 |
| `SCREEN_DIGEST_LIST_CONTENT_PADDING_TOP` | 12 | 다이제스트 아래 **스크롤 리스트** 상단 (`COMFORT_TOP_FIXED_GAP`과 동일) |
| `SCREEN_LIST_CONTENT_PADDING_TOP` | 12 | 고정 UI 아래 **스크롤 리스트** 상단 (다이제스트 없을 때) |
| `SCREEN_WIDE_CONTENT_PADDING_TOP` | 16 | wide 2-pane 본문 컬럼 상단 |
| `SCREEN_EMBEDDED_WIDE_PADDING_TOP` | 18 | 사이드바 임베디드 스택 본문 상단 |
| `SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL` | 20 | 사이드바 임베디드 스택 가로 |

### 레이어 구조 (iPhone 탭 — 뉴스·공시)

```
SafeAreaView edges={['top']}
  SignalHeader compact
  [OtaUpdateBanner]
  topFixedStack (gap: COMFORT_TOP_FIXED_GAP = 12)
    topFixedSubmenu (submenuStrip — theme.card + 하단 구분선)
      세그먼트 underline
    topFixedDigest (digestSlot — 배경 없음)
      DigestPager / DisclosureDigestSection
  [FeedNewContentChip]
  FlatList  ← SCREEN_DIGEST_LIST_CONTENT_PADDING_TOP (다이제스트 있을 때)
  SignalFloatingTabBar
```

다이제스트가 없는 세그먼트(뉴스 IT·Video, 공시 종목 필터 등)는 `SCREEN_LIST_CONTENT_PADDING_TOP`(12)을 쓴다. 뉴스 Video 세그먼트는 `YoutubeFeedPanel`을 **embedded**(채널 필터 스트립 숨김)로 쓴다.

### 레이어 구조 (iPhone 탭 — 날짜+세그먼트 리스트: 시장·뉴스/공시 플로우)

```
SafeAreaView edges={['top']}
  SignalHeader compact
  [OtaUpdateBanner]
  topFixed                         ← getScreenFixedHeaderStyles / FIXED_HEADER_*
    SignalDateNavigator            ← 날짜 먼저 (C1 단일 셸)
    Segment control                ← 그다음 세그먼트
  FlatList / ScrollView            ← SCREEN_LIST_CONTENT_PADDING_TOP
  SignalFloatingTabBar (layout)
```

### 레이어 구조 (iPhone 탭 — 일반)

```
SafeAreaView edges={['top']}
  SignalHeader compact
  [OtaUpdateBanner]
  topFixed | dateNavigatorWrap     ← SCREEN_HEADER_CONTENT_GAP / FIXED_HEADER_*
    날짜 바 · 세그먼트 · 배너       ← 날짜가 있으면 날짜가 세그먼트보다 위
  ScrollView / FlatList            ← SCREEN_LIST_CONTENT_PADDING_TOP
  SignalFloatingTabBar (layout)
```

- **`topFixed` 패턴**: 뉴스·시세·공시·유튜브·게시판·홈·시장 — `getScreenFixedHeaderStyles()` 스트립(`theme.card` + 하단 구분선)으로 스크롤 밖 고정. 알림함(`app/alerts.tsx`) 등 스택 화면도 동일 스트립 패턴.
- **뉴스·공시 고정 스택**: 세그먼트는 `submenuStrip`(카드 배경), 다이제스트는 `digestSlot`(배경 없음)으로 분리. `fixedStack` 내부 gap은 `COMFORT_TOP_FIXED_GAP`(12).
- **날짜 바 패턴**: 홈·시장·캘린더·뉴스/공시 플로우 — `SignalDateNavigator`를 고정 스트립(`topFixed` / `fixedTop`) 안에 배치. **C1**: 바깥 셸 1개만(보더·`bgElevated`), 안쪽 화살표/날짜/오늘 컨트롤은 보더·배경 없이 Ionicons + 텍스트. 뉴스·공시 플로우 리스트는 시장 브리핑과 같이 **날짜 바 → 세그먼트** 순서로 `topFixed`에 둔다.
- **설정**: More 탭에는 없음. **My info** 허브의 「환경 설정」에서 진입. iPhone은 `app/settings?from=account` — 이때 설정 상단 pill 서브탭은 숨긴다. 웹·iPad는 사이드바 **게시판 아래 내 정보**로 진입하고, 퀵 링크는 사이드바 하단 도크(`SidebarReferenceLinksDock`)에 둔다. More 항목은 사이드바에 없음.
- **마감 브리핑 상세** (`app/today-briefing.tsx`): 폰은 Expo Stack 제목 = 「마감 브리핑」, 날짜는 헤더 바로 아래 고정 `dateBar`. 본문은 헤드라인 + `TodayBriefingBlock`(시장 브리핑 lead·출처와 동일). 홈 카드는 `TodayBriefingSheet`. wide는 아래 우측 pane 규칙을 따른다.

## Wide 우측 pane 내비 (iPad · 넓은 웹)

모달형 overlay가 아니다. **좌측 메뉴 + 상단 `SignalHeader`는 고정**이고, **우측만** 페이지처럼 교체한다.

| 상황 | `WideSubpaneHeader` |
|---|---|
| 사이드바·직접 URL로 우측 루트 화면을 연 경우 | **없음** (본문만) |
| 우측 화면 **안에서** 다른 화면으로 드릴인 | **있음** — 뒤로 → **직전 우측 화면** |

규칙:

1. 크롬은 `WideSubpaneHeader`(chevron만 + 제목) **하나**로 통일. 화면마다 다른 back UI를 두지 않는다.
2. 진입 출처는 **공유 URL 쿼리(`from=`)에 넣지 않는다.** 세션/인메모리(또는 router state)로만 둔다. URL을 복사해 다른 브라우저에서 열면 루트 진입과 같이 헤더 없음.
3. 본문 레이아웃(뉴스 리스트·보드 카드 등)은 화면 고유. 맞추는 것은 **back 헤더 스트립뿐**.
4. 드릴인이 2단 이상이면 우측 pane 안에서 back 스택을 쌓아 한 단계씩 복귀한다. **같은 overlay 안에서** 카테고리·세션·날짜 등 쿼리만 바뀌는 경우(서브메뉴)에는 drill back 스택을 비우지 않는다.
5. 사이드바 **홈**은 홈 섹션(드릴 포함)에서 하이라이트되지만, 홈 루트가 아니면 탭 시 홈 루트로 리셋한다. 오버레이 → 다른 좌측 탭 이동 중에는 오래된 `?overlay=` URL sync가 pane을 되돌리지 않게 한다.
6. 구현 식별자 `?overlay=` 등은 **우측 pane 라우팅용**이며 UI 오버레이가 아니다. 점진적으로 전용 경로/`contentPane`으로 정리해도 된다.

대상 예: 홈 → 뉴스플로우·오늘의 브리핑·**시장 브리핑**·캘린더·**보드 목록·게시글·심볼**·내 정보 하위(설정·알림·약관) 및 그 안의 상세. 공시 플로우는 더보기/공시 탭에서 진입. 직접 `/community/…`·`/symbol/…`는 루트 진입(헤더 없음). 사이드바 **시장** 탭 직접 진입은 드릴인이 아니므로 `WideSubpaneHeader` 없음.

## iPhone · 좁은 웹

wide 우측 pane 규칙을 **적용하지 않는다.** 탭바·Expo Stack·화면별 `SignalHeader compact` 등 **현행 유지**.

### More 허브 자식 · My info 하위

| 진입 | 뒤로 크롬 |
|---|---|
| More → 보드·공시·My info | **같은 root Stack** — native 헤더 + `PhoneHeaderBackButton`(chevron만) |
| 홈 → 시장 브리핑·보드 | root Stack (`/market-briefing`, `/more-board`) — 동일 `PhoneHeaderBackButton` |
| My info → 프로필·비밀번호·소셜 | 같은 Stack 헤더 + `PhoneHeaderBackButton` → 허브 |
| 홈 등에서 시장 탭 직접 | `SignalHeader` (하단 탭 진입 — Stack 드릴인 아님) |

뒤로 UI는 **플랫폼 공통 chevron만** (`PhoneHeaderBackButton`). 「뒤로」 라벨·pill 배경 없음. a11y만 `commonBack`. `WideSubpaneHeader` / `IpadSidebarScreen`도 동일 컨트롤.

## Pull-to-refresh · chip · digest (상호작용)

PTR, 새 소식 chip, digest 갱신, 폴링, 캐시 모드는 **[FEED-INTERACTION.md](./FEED-INTERACTION.md)** 를 따른다.

레이아웃 관점만 요약:

- digest·세그먼트·날짜·OTA는 **스크롤 밖** (`topFixed`).
- digest 가로 스크롤: **자유 스크롤 스트립** (`WebHorizontalScrollStrip`) — 페이지 스냅·휠 가로채기 금지. 상세는 [FEED-INTERACTION.md §5](./FEED-INTERACTION.md#5-고정-digest).
- chip·OTA strip은 **리스트 바로 위** (`UpdatePromptStrip`).
- `ListHeaderComponent`에는 digest·필터·로딩을 넣지 않는다. 내용이 없으면 `null`을 반환해 빈 상단 패딩을 두지 않는다.

## 하단 스크롤 패딩

| 상수 | px | 용도 |
|---|---:|---|
| `SCREEN_TAB_SCROLL_BOTTOM_BASE` | 24 | iPhone 탭 + 플로팅 탭바 |
| `SCREEN_STACK_SCROLL_BOTTOM_BASE` | 28 | 스택 화면 |
| `SCREEN_WIDE_SCROLL_BOTTOM_BASE` | 32 | iPad·wide (탭바 없음) |
| `SCREEN_FAB_ABOVE_TAB_OFFSET` | 8 | FAB lift |

### 헬퍼 (직접 숫자 합산 지양)

```ts
import {
  fabStackBottom,
  stackScreenScrollBottomPadding,
  tabScreenScrollBottomPadding,
} from '@/constants/screenLayout';

// 탭 화면 FlatList / ScrollView
paddingBottom: tabScreenScrollBottomPadding(tabBarHeight, insets.bottom);

// 스택 화면
paddingBottom: stackScreenScrollBottomPadding(insets.bottom);

// wide 탭 / iPad 홈
paddingBottom: SCREEN_WIDE_SCROLL_BOTTOM_BASE;

// FAB
bottom: fabStackBottom(tabBarHeight, insets.bottom);
```

`tabBarHeight`는 `useBottomTabBarHeight()`, inset은 `useSafeAreaInsets().bottom`.

## 플랫폼별 차이

| 항목 | iPhone | iPad / wide web |
|---|---|---|
| 상단 헤더 | 탭마다 `SignalHeader` | `_layout` 전역 1회 |
| 세그먼트 | `topFixed` 또는 화면 내 | `SidebarSubTabsContext`(`href`+`params`)로 사이드바 — 각 서브탭 URL에 필터 값을 항상 명시 |
| 콘텐츠 폭 | max 720 중앙 | 탭·홈·뉴스/공시 플로우: pane 전체 (`wideContentFill`); 일부 임베디드 상세: max 1120 |
| 하단 | 탭바 + inset 헬퍼 | `SCREEN_WIDE_SCROLL_BOTTOM_BASE` |
| 가로 pad | 16 | 탭 pane: 16 또는 0(`wideContentFill`); 임베디드 스택: 20 |

웹 wide는 900px breakpoint를 쓰고, 네이티브 iPad는 항상 wide다. 스크롤 viewport는 `constants/webLayout.ts`의 `webScrollViewportStyle`을 따른다.

## 재사용 레이아웃 컴포넌트

| 컴포넌트 | 용도 |
|---|---|
| `WideWebShell` | wide — 고정 사이드바 + 전역 `SignalHeader` |
| `WideSubpaneHeader` | wide 우측 pane 드릴인 — chevron + 제목 |
| `PhoneHeaderBackButton` | iPhone / iPad / web 공통 뒤로 — chevron만 |
| `IpadSidebarScreen` | wide 스택 — (레거시/미사용에 가깝고, 신규는 `WideSubpaneHeader` 규칙 우선) |
| `MasterDetailLayout` | 시세·공시 2-pane |
| `IpadHomeScreen` | wide 홈 |
| `WebWheelScrollView` / `WebWheelFlatList` | 웹 휠 스크롤 |

**wide 2-pane 주의:** `SCREEN_WIDE_CONTENT_PADDING_TOP`은 **행(`wideBody`) 또는 리스트(`listContentWide`) 중 한 곳에만** 적용한다. 둘 다 더하면 왼쪽 리스트 상단이 과하게 벌어진다. `ListHeaderComponent`는 wide에서 `paddingTop: 0`(`listHeaderWide`)으로 두고, 행 padding만 쓴다.

새 화면은 위 패턴 중 하나를 선택하고, 여백은 `screenLayout` 상수만 사용한다.

## 새 화면 체크리스트

1. `useResponsiveLayout()` → `useTwoPane` 분기
2. Safe Area `edges` 표준 적용
3. iPhone만 `SignalHeader compact` (wide는 `WideWebShell` 전역 헤더 — 중복 금지)
4. wide에서 우측 드릴인이면 `WideSubpaneHeader` (루트 진입·직접 URL에는 없음)
5. 고정 UI 있으면 `getScreenFixedHeaderStyles()` → `topFixed` + `SCREEN_FIXED_HEADER_*`
6. 리스트 `paddingTop`: 다이제스트 있으면 `SCREEN_DIGEST_LIST_CONTENT_PADDING_TOP`, 없으면 `SCREEN_LIST_CONTENT_PADDING_TOP`
7. 하단: `tabScreenScrollBottomPadding` / `stackScreenScrollBottomPadding` / `SCREEN_WIDE_SCROLL_BOTTOM_BASE`
8. 가로: `APP_CONTENT_SIDE_PADDING` (리터럴 `16` 지양)
9. FAB: `fabStackBottom` (예: 시세 관심 탭 추가 버튼)
10. PTR·chip·폴링: [FEED-INTERACTION.md](./FEED-INTERACTION.md) 체크리스트

## 관련 파일

- `constants/screenFixedHeader.ts` — 상단 고정 스트립 스타일 (`getScreenFixedHeaderStyles`)
- `constants/screenLayout.ts` — 여백 상수·헬퍼
- `constants/responsiveLayout.ts` — 폭·breakpoint
- `constants/segmentTabBar.ts` — 세그먼트 underline 스타일 (`getSegmentTabBarStyles`) + screenLayout re-export
- `constants/webLayout.ts` — 웹 flex/scroll
- `constants/tabBar.ts` — 탭바 치수·inset
- `docs/FEED-INTERACTION.md` — PTR·chip·폴링·캐시 상호작용
- `components/signal/UpdatePromptStrip.tsx` — chip·OTA strip UI
- `components/signal/FeedNewContentChip.tsx`
- `components/signal/SignalHeader.tsx`
- `app/(tabs)/_layout.tsx` — wide 탭 셸
