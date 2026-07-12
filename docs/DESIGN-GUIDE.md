# SIGNAL 디자인 가이드

앱 UI·UX의 현재 기준이다. **코드 상수가 단일 출처**이고, 이 문서는 의도와 사용 규칙을 설명한다.

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
| `bg` / `bgElevated` | 화면 배경 / 세그먼트·입력 트랙 배경 |
| `card` | 카드·고정 헤더 스트립·모달 본문 |
| `border` | 구분선·테두리 |
| `text` / `textMuted` / `textDim` | 본문 / 보조 / 캡션 |
| `danger` / `warning` | 오류·주의 |

규칙:

- 화면마다 hex를 직접 쓰지 않고 `useSignalTheme()`의 `theme`만 사용한다.
- 다크 모드에서도 `card`·`bg` 계층을 유지한다 (순백 카드 금지).
- 강조는 `theme.green` 하나로 통일한다. 세그먼트 활성 텍스트만 `#FFFFFF` 고정 (`segmentTabBar.ts`).

## 타이포그래피

| 계층 | 상수·패턴 | 용도 |
|---|---|---|
| 피드 제목 | `FEED_ARTICLE_TITLE_PX` (15) | 뉴스·공시 리스트 |
| 다이제스트 제목 | `FEED_DIGEST_TITLE_PX` (14) | 홈·이슈·DigestPager |
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
| `UI_RADIUS_SEGMENT_OUTER` / `BTN` | 8 / 6 | 세그먼트 pill |
| `UI_RADIUS_SHEET` | 14 | 바텀 시트 |
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

상세 수치·헬퍼는 [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md)를 따른다. 리터럴 `16`·`paddingBottom` 합산을 화면에 직접 쓰지 않는다.

## 반응형 레이아웃

`useResponsiveLayout()` (`hooks/useResponsiveLayout.ts`):

| 모드 | 조건 | 동작 |
|---|---|---|
| compact | 너비 < 768 | iPhone — 플로팅 탭바, 탭마다 `SignalHeader compact` |
| regular | 768–899 | iPhone 가로 등 |
| wide | iPad·웹 ≥ 900 | 좌측 사이드바, 전역 헤더 1회, 2-pane 가능 |

콘텐츠 최대 폭: 720 (일반) / 1120 (wide). 가로 inset 16.

## 고정 헤더·세그먼트

### `topFixed` 스트립

스크롤 밖 고정 UI — 세그먼트, 날짜 바, 다이제스트, OTA, chip strip.

```ts
getScreenFixedHeaderStyles(theme) // constants/screenFixedHeader.ts
```

- 배경 `theme.card` + 하단 hairline `theme.border`
- 패딩: `SCREEN_FIXED_HEADER_*` + 내부 `COMFORT_TOP_FIXED_GAP`
- wide: `stripWide`로 상단만 `SCREEN_WIDE_CONTENT_PADDING_TOP`

적용 화면: 뉴스·공시·시세·유튜브·게시판·홈·시장·알림함·설정·계정 등.

### 세그먼트 pill

`getSegmentTabBarStyles(theme, scaleFont)` — `constants/segmentTabBar.ts`

- 트랙: `bgElevated` + border
- 활성: `theme.green` 배경 + 흰 텍스트
- iPhone 탭 상단·설정/계정 서브탭·시장 세션 등 **동일 스타일**

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

- 출처 숏컷(LikeUSStock · SAVE): **2열 그리드** — `ExternalLinkGrid` (`preferredColumns: 2`)
- 아래에 최근 글 목록 또는 빈 상태 문구

### 종목 상세 바로가기

- `SymbolExternalLinksGrid` — 파비콘(24px) + 이름, **3열 우선**(wide 4열)·`flexWrap` 그리드
- 해외: Naver → Toss → Yahoo → Earnings → SEC → Google → TradingView
- 국내: Naver → Toss → Google → 네이버 뉴스 → 네이버 공시 → DART
- `ExternalLinkGrid` — 파비콘·숏컷 공통 그리드 (`components/common/ExternalLinkGrid.tsx`)

### 더보기 숏링크

- `ReferenceLinksSection` — 아이콘/마크 원 + 2줄 라벨, **3열 우선** (`onLayout` 실측 + 행 단위 flex)
- 셀 최소 폭 72px, 동적 열 수 (동일 `externalLinkGrid` 유틸)

## 컴포넌트 재사용

| 컴포넌트 | 용도 |
|---|---|
| `SignalHeader` | iPhone 탭 상단 / wide 전역 |
| `SignalFloatingTabBar` | iPhone 하단 탭 |
| `IpadSidebarScreen` | wide 스택 |
| `MasterDetailLayout` | 시세·공시 2-pane |
| `ThemedRefreshControl` | PTR |
| `UpdatePromptStrip` | chip·OTA strip |
| `WebWheelFlatList` / `WebWheelScrollView` | 웹 스크롤 |
| `FloatingGlassFab` | FAB (시세 관심·뉴스 번역 등) |

## 새 화면 체크리스트

1. `useResponsiveLayout()` → `useTwoPane` 분기
2. Safe Area `edges` — [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md)
3. 고정 UI → `getScreenFixedHeaderStyles()` + `topFixed`
4. 여백·하단 패딩 → `screenLayout` 헬퍼만
5. 색·radius·gap → `theme` / `uiCornerRadius` / `comfortDensity`
6. 피드 화면이면 → [FEED-INTERACTION.md 체크리스트](./FEED-INTERACTION.md#9-새-피드-화면-체크리스트)
7. 외부 URL 열기 → `openConfiguredExternalLink` ([DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md))

## Admin UI

모바일 앱과 별도. [SIGNAL-ADMIN-UIUX.md](./SIGNAL-ADMIN-UIUX.md)를 따른다.

## 관련 문서

| 문서 | 내용 |
|---|---|
| [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md) | Safe Area·여백·2-pane 상세 |
| [FEED-INTERACTION.md](./FEED-INTERACTION.md) | PTR·chip·digest·폴링 |
| [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md) | 구현·API·외부 링크 |
| [SIGNAL-PRD.md](./SIGNAL-PRD.md) | 제품·화면 역할 |
