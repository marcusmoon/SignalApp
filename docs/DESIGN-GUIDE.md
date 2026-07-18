# SIGNAL 디자인 가이드

앱 UI·UX의 현재 기준이다. **코드 상수가 단일 출처**이고, 이 문서는 의도와 사용 규칙을 설명한다.

**다른 앱에 같은 기준을 이식할 때**는 [APP-UI-PLAYBOOK.md](./APP-UI-PLAYBOOK.md)를 먼저 본다. 이 문서는 SIGNAL 구현 상세다.

## 목표

- 시장 정보를 **빠르게 스캔**할 수 있는 밀도와 계층
- iPhone · iPad · 웹에서 **동일한 정보 구조**, 레이아웃만 반응형으로 분기
- 라이트·다크 모두에서 **의미 색상·대비** 유지

## 테마·색상

`constants/theme.ts` — Toss-inspired 시맨틱 토큰.

| 토큰 | 용도 |
|---|---|
| `green` | 브랜드 액센트 (`#3182F6`, 링크·활성·강조) |
| `greenDim` | 액센트 배경(칩 pressed, 선택 배경) |
| `bg` / `bgElevated` | 화면 배경 / 입력·칩 트랙 배경 |
| `card` | 카드·고정 헤더 스트립·모달 본문 |
| `border` | 구분선·테두리 |
| `text` / `textMuted` / `textDim` | 본문 / 보조 / 캡션 |
| `danger` / `warning` | 오류·주의 |

규칙:

- 화면마다 hex를 직접 쓰지 않고 `useSignalTheme()`의 `theme`만 사용한다.
- 다크 모드에서도 `card`·`bg` 계층을 유지한다 (순백 카드 금지).
- 강조는 `theme.green` 하나로 통일한다. 세그먼트 활성은 하단 green underline + green 텍스트 (`segmentTabBar.ts`).

## 타이포그래피

| 계층 | 상수·패턴 | 용도 |
|---|---|---|
| 피드 제목 | `FEED_ARTICLE_TITLE_PX` (15) · line `FEED_ARTICLE_TITLE_LINE_PX` (22) | 뉴스·공시·게시판 리스트 |
| 다이제스트·유튜브 제목 | `FEED_DIGEST_TITLE_PX` (14) · line `FEED_DIGEST_TITLE_LINE_PX` (20) | 홈·이슈·**유튜브**(썸네일 행) |
| 상세 제목 | `FEED_DETAIL_TITLE_PX` (17) | 확장 카드 |
| 본문·요약 | `FEED_BODY_PX` / `FEED_PREVIEW_BODY_PX` | 미리보기 |
| 메타·배지 | `FEED_META_*` / `FEED_BADGE_PX` | 시간·출처·칩 |
| UI 라벨 | `scaleFont(n)` via `useSignalTheme()` | 버튼·설정·탭 |

`constants/feedTypography.ts` + `scaleFont`로 접근성·플랫폼별 스케일을 맞춘다.

## 모서리·간격

### 모서리 (`constants/uiCornerRadius.ts`)

| 상수 | px | 용도 |
|---|---:|---|
| `UI_RADIUS_TAB_BAR_FLOAT` | 22 | 플로팅 탭바 캡슐 |
| `UI_RADIUS_GROUPED_FEED` | 16 | 뉴스·공시 그룹 카드 |
| `UI_RADIUS_CARD` | 10 | 일반 카드·타일 |
| `UI_RADIUS_CARD_LG` | 12 | 히어로·큰 카드 |
| `UI_RADIUS_SEGMENT_OUTER` / `BTN` | 8 / 6 | (레거시 상수 · underline 세그먼트는 0) |
| `UI_RADIUS_SHEET` | 14 | 바텀 시트 |

### 바텀 시트 (`constants/bottomSheetLayout.ts`)

slide-up Modal 시트(홈 다이제스트 상세·마켓 브리핑·퀵 설정·필터·날짜 선택 등)는 **뷰포트 높이의 70%를 넘지 않는다** (`BOTTOM_SHEET_MAX_HEIGHT`). 본문은 시트 안 `ScrollView` + `BOTTOM_SHEET_SCROLL_STYLE`로 스크롤한다.

| `UI_RADIUS_DIGEST_*` | 12 / 10 | 다이제스트 카드 |

pill 칩(`borderRadius: 999`)·아주 작은 radius는 예외로 유지한다.

### 간격 (`constants/comfortDensity.ts`)

| 상수 | px | 용도 |
|---|---:|---|
| `COMFORT_TOP_FIXED_GAP` | 12 | `topFixed` 내부 세로 gap |
| `COMFORT_GAP_SM` / `MD` / `LG` | 12 / 12 / 16 | 행·섹션 gap |
| `COMFORT_MARGIN_CARD` | 14 | 카드 하단 margin |
| `COMFORT_PADDING_ROW_V` | 12 | 리스트 행 세로 패딩 |

### 화면 여백 (`constants/screenLayout.ts`)

| 상수 | px | 용도 |
|---|---:|---|
| `SCREEN_DIGEST_LIST_CONTENT_PADDING_TOP` | 12 | 다이제스트 아래 리스트 상단 |
| `SCREEN_LIST_CONTENT_PADDING_TOP` | 12 | 고정 UI 아래 리스트 상단 (다이제스트 없을 때) |

상세 수치·헬퍼는 [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md)를 따른다. 리터럴 `16`·`paddingBottom` 합산을 화면에 직접 쓰지 않는다.

## 반응형 레이아웃

`useResponsiveLayout()` (`hooks/useResponsiveLayout.ts`):

| 모드 | 조건 | 동작 |
|---|---|---|
| compact | 너비 < 768 | iPhone — 플로팅 탭바, 탭마다 `SignalHeader compact` |
| regular | 768–899 | iPhone 가로·좁은 웹 등 |
| wide | 네이티브 iPad(항상) · 웹 ≥ 900 | 좌측 사이드바, 전역 헤더 1회, 우측 pane만 교체 |

콘텐츠 최대 폭: 720 (일반). wide 탭·홈·뉴스/공시 플로우는 우측 pane 전체; 일부 임베디드 상세만 1120. 가로 inset 16.

## 고정 헤더·세그먼트

### `topFixed` 스트립

스크롤 밖 고정 UI — 세그먼트, 날짜 바, 다이제스트, OTA, chip strip.

```ts
getScreenFixedHeaderStyles(theme) // constants/screenFixedHeader.ts
```

- 단일 스트립: 배경 `theme.card` + 하단 hairline `theme.border`
- 패딩: `SCREEN_FIXED_HEADER_*` + 내부 `COMFORT_TOP_FIXED_GAP`
- wide: `stripWide` / `fixedStackWide`로 상단만 `SCREEN_WIDE_CONTENT_PADDING_TOP`

**뉴스·공시 분리 스택** (`topFixedStack`):

| 슬롯 | 스타일 | 배경 |
|---|---|---|
| `topFixedSubmenu` | `submenuStrip` | `theme.card` + 구분선 |
| `topFixedDigest` | `digestSlot` | 없음 (투명) |

다이제스트↔리스트 간격은 `SCREEN_DIGEST_LIST_CONTENT_PADDING_TOP`(12) = 세그먼트↔다이제스트 `COMFORT_TOP_FIXED_GAP`과 동일.

적용 화면: 뉴스·공시·시세·유튜브·게시판·홈·시장·알림함·설정 등.

### 세그먼트 (underline)

`getSegmentTabBarStyles(theme, scaleFont)` — `constants/segmentTabBar.ts`

- 트랙/채움 pill 없음. 행 하단 hairline만
- 활성: 하단 **green 2px** 라인 + 텍스트 `theme.green` / semibold
- 비활성: `theme.textDim`
- iPhone 탭 상단·설정/계정 서브탭·시장 세션 등 **동일 스타일**

### 날짜 바 (`SignalDateNavigator`)

- **C1**: 바깥 셸 1개만(보더·`bgElevated`). 안쪽 화살표/날짜/오늘은 보더·배경 없이 Ionicons + 텍스트
- 날짜가 있는 리스트형 화면(시장·뉴스/공시 플로우 등): `topFixed` 안에서 **날짜 → 세그먼트** 순서

### 탭 · 사이드바 아이콘

- 비선택: Ionicons `*-outline` / 선택: 동일 계열 filled
- iPhone 탭바(`app/(tabs)/_layout.tsx`)와 wide 사이드바 **같은 매핑**

## 홈 · 시황 브리핑 밀도

- 섹션 제목만 두고 **부제(subtitle) 없음** (`HomeFocusContent`)
- 홈 시황 카드: 헤드라인 + 본문 **최대 2줄**. 행 탭 → `MarketBriefingSheet`(해당 회차), 섹션 헤더 → 시장 브리핑 화면
- 홈 노출 개수: 설정 → 표시에서 **스크롤 피커**(시세 개수와 동일 패턴). 시황 브리핑 기본 2 · 최대 4 (`homeMarketBriefingDisplayPreference`)
- 상세(`MarketBriefingBlock` 등): 섹터·매크로·출처 본문은 말줄임 없이 전체 표시
- 콘텐츠 카드는 구분선·간격으로 구조를 잡는다 — **좌측 accent 세로 바 없음**

## 피드·리스트·다이제스트

상호작용(PTR, chip, 폴링)은 [FEED-INTERACTION.md](./FEED-INTERACTION.md). 여기서는 **시각 구조**만 정리한다.

### 리스트

- 고정 UI는 `ListHeaderComponent`에 넣지 않는다 → `topFixed` 사용
- 그룹 카드: `UI_RADIUS_GROUPED_FEED`, 카드 간 `COMFORT_MARGIN_GROUP`
- 새 소식 chip: `FeedNewContentChip` — `theme.card` + green 2px 테두리, 리스트 바로 위

### 다이제스트 가로 스트립

- `WebHorizontalScrollStrip` — **자유 스크롤** (페이지 스냅·dots 금지)
- 다음 카드 peek: compact 36px / wide 2열 0.48 비율 (`digestStripLayout.ts`)
- 끝 refresh 타일: `DigestRefreshTail`
- 출처: 카드 우측 「출처」→ `DigestSourcesSheet` (인라인 펼치기 금지)

### 홈 게시판 (Board)

- 최근 글 목록 또는 빈 상태 문구 (출처 숏컷 없음)

### 더보기 · My info

- **더보기** (`app/(tabs)/more.tsx`): **iPhone만** — IT 뉴스·게시판·공시·유튜브·My info 숏컷 + 참고 링크 + 광고. 설정 메뉴는 없음. 허브 순서: `constants/moreHubOrder.ts`.
- **IT 뉴스** (`app/(tabs)/it-news.tsx`, `ItNewsFeedPanel`): GeekNews RSS(`category=it`). iPhone은 More → `/more-it-news`, wide는 사이드바(내 정보 위).
- **웹·iPad 사이드바**: More 항목 없음. 순서 — 홈 · 뉴스 · 시장 · 시세 · 공시 · 유튜브 · 게시판 · **IT 뉴스** · **내 정보**. 설정은 내 정보 허브에서 진입.
- **My info** (`app/account.tsx`): 허브 — 환경 설정(표시·알림·뉴스·시세·개발 모드), 내 활동(알림), 계정(프로필·소셜 연동·비밀번호·약관).
- **퀵 설정** (`QuickSettingsSheet`): 헤더 우측 options 아이콘. 언어·화면 모드. 푸터 **More settings** → 전체 설정(pill 탭 표시, iPhone·iPad 동일).
- **설정** (`app/settings.tsx`): 탭 순서 `constants/settingsTabs.ts`.
  - **전체 설정**(퀵 설정·알림 등, `from≠account`): 상단 pill 서브탭 표시(iPhone·embedded iPad 공통).
  - **My info 드릴인**(`from=account` / `settingsFromAccount`): pill 숨김·단일 탭. wide는 `WideSubpaneHeader`(chevron→내 정보).
- **Wide 우측 pane**: 좌측 사이드바·상단 `SignalHeader` 고정, 우측만 페이지 교체. 드릴인 시에만 `WideSubpaneHeader`. 상세는 [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md#wide-우측-pane-내비-ipad--넓은-웹).
- **개발자 캡슐**: `DeveloperFooterDock` — More 탭 하단 탭바 위 Marcus·LinkedIn (개발 모드에서만, iPhone).

### 마감 브리핑 상세

`app/today-briefing.tsx` — 홈 카드 「전체 보기」 진입.

- Stack 헤더 제목: `todayBriefingDetailKicker` (마감 브리핑)
- 날짜: 헤더 바로 아래 고정 `dateBar` (본문 kicker 중복 없음)
- 본문: 히어로 카드 → 핵심 포인트 · 출처 (`HomeDigestFeedRow` 스타일)

### 종목 상세 바로가기

- `SymbolExternalLinksGrid` — 파비콘(24px) + 이름, **3열 우선**(wide 4열)·`flexWrap` 그리드
- 해외: Naver → Toss → Yahoo → Earnings → SEC → Google → TradingView
- 국내: Naver → Toss → Google → 네이버 뉴스 → 네이버 공시 → DART
- `ExternalLinkGrid` — 파비콘·숏컷 공통 그리드 (`components/common/ExternalLinkGrid.tsx`)

### 더보기 숏링크 · 사이드바 퀵 링크

- **iPhone**: `ReferenceLinksSection` — 아이콘 + 라벨, 4열 우선. 더보기 하단에 표시.
- **웹·iPad**: `SidebarReferenceLinksDock` — 파비콘만 4열 슬림 바. 좌측 사이드바 **하단 도크**.
- 표시 여부: 설정 → 표시의 퀵 링크 토글 (`moreReferenceLinksPreference`).

## 컴포넌트 재사용

| 컴포넌트 | 용도 |
|---|---|
| `SignalHeader` | iPhone 탭 상단 / wide 전역(고정). 맨 우측 **options-outline** → `QuickSettingsSheet`(언어·화면 모드 · More settings) |
| `QuickSettingsSheet` / `MarketBriefingSheet` | 바텀 시트 — `BOTTOM_SHEET_MAX_HEIGHT` 70% |
| `ItNewsFeedPanel` | IT 뉴스 리스트 (`category=it`) |
| `WideSubpaneHeader` | wide 우측 pane **드릴인** — chevron + 제목 (`PhoneHeaderBackButton`) |
| `SignalFloatingTabBar` | iPhone 하단 탭 |
| `IpadSidebarScreen` | wide 스택 |
| `MasterDetailLayout` | 시세·공시 2-pane |
| `ThemedRefreshControl` | PTR |
| `UpdatePromptStrip` | chip·OTA strip |
| `WebWheelFlatList` / `WebWheelScrollView` | 웹 스크롤 |
| `FloatingGlassFab` | FAB (시세 관심·뉴스 번역 등) |

## 웹 스크롤바

앱 스크롤 뷰포트(`data-signal-scroll-viewport` 등)의 세로 스크롤바는 숨긴다. 휠·트랙패드로만 스크롤. 구현: `app/+html.tsx` 글로벌 CSS.

## 새 화면 체크리스트

교차 앱 공통 항목은 [APP-UI-PLAYBOOK.md §11](./APP-UI-PLAYBOOK.md#11-새-앱--새-화면-체크리스트). SIGNAL 화면 단위:

1. `useResponsiveLayout()` → `useTwoPane` 분기
2. Safe Area `edges` — [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md)
3. 고정 UI → `getScreenFixedHeaderStyles()` + `topFixed` (날짜 있으면 날짜 → 세그먼트)
4. 여백·하단 패딩 → `screenLayout` 헬퍼만
5. 색·radius·gap → `theme` / `uiCornerRadius` / `comfortDensity`
6. wide 탭·플로우 루트 → `wideContentFill` (불필요한 1120 캡 금지)
7. 피드 화면이면 → [FEED-INTERACTION.md 체크리스트](./FEED-INTERACTION.md#9-새-피드-화면-체크리스트)
8. 외부 URL 열기 → `openConfiguredExternalLink` ([DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md))

## Admin UI

모바일 앱과 별도. [SIGNAL-ADMIN-UIUX.md](./SIGNAL-ADMIN-UIUX.md)를 따른다.

## 관련 문서

| 문서 | 내용 |
|---|---|
| [APP-UI-PLAYBOOK.md](./APP-UI-PLAYBOOK.md) | **다른 앱 이식용** UI 운영 표준 |
| [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md) | Safe Area·여백·2-pane 상세 |
| [FEED-INTERACTION.md](./FEED-INTERACTION.md) | PTR·chip·digest·폴링 |
| [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md) | 구현·API·외부 링크 |
| [SIGNAL-PRD.md](./SIGNAL-PRD.md) | 제품·화면 역할 |
