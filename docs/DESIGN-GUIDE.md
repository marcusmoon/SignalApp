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
| 메타·배지 | `FEED_META_*` / `FEED_BADGE_PX` | 시간·출처 |
| 칩 라벨 | `FEED_CHIP_PX` (10) | 홈 키워드·뉴스/다이제스트 topic 칩 |
| 홈 트렌드 | `HomeSectionHeader`(아이콘·제목·as-of) + 칩 카드 (`FEED_CHIP_PX`) | 홈 최상단. 피처드 없음 |
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

slide-up Modal 시트(다이제스트 스트립 「출처」·퀵 설정·필터·날짜 선택 등)는 **뷰포트 높이의 70%를 넘지 않는다** (`BOTTOM_SHEET_MAX_HEIGHT`). 본문은 시트 안 `ScrollView` + `BOTTOM_SHEET_SCROLL_STYLE`로 스크롤한다.

### 시트 vs 상세 화면

| 진입 | UI | 이유 |
|---|---|---|
| 홈 뉴스 흐름 행 · 뉴스/공시 목록 행 | **단건 상세** (`/news-digest` · `/disclosure-digest`) | 탭한 그 항목의 본문·출처 |
| 홈 히어로(오늘 정리·장중) · 섹터 흐름 카드 | **상세** (`/today-briefing` · `/market-briefing` · `/etf-insight`) | 긴 본문 — 시트 70% 스크롤 지양 |
| 홈 섹션 `>` | 없음 | 목록·탭은 시장·시세·더보기·사이드바 |
| 알림함·푸시 | **단건 상세** (날짜바·회차 없음 — 공통 드릴 헤더(섹션명) + 본문 헤드라인) | 알림이 가리킨 그 정보만 |
| 다이제스트 스트립 「출처」·퀵 설정·필터·날짜 | 바텀 시트 | 짧은 보조 UI |

레거시 deepLink `/news-issues?digestId=` · `/disclosure-flow?digestId=` 는 앱이 상세로 redirect한다.

**단건 상세 공통 셸** (`BriefingDetailShell`): 홈 숏컷과 **동일 드릴 헤더** — `signalDrillStackOptions` / `WideSubpaneHeader`(chevron + 섹션명 `chromeTitle`). `dateBar` 없음. 본문: 헤드라인(단건 제목) → **시간 메타**(`headlineMeta`: 상대·절대, 장중은 회차 접두) → leadPanel(초록 tint) → `sectionFeedCard`. 오늘 정리·장중·ETF·뉴스/공시 다이제스트가 동일 뼈대.

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
| `SCREEN_HEADER_CONTENT_GAP` | 12 | `SignalHeader` 아래 → 첫 고정 UI |
| `SCREEN_DIGEST_LIST_CONTENT_PADDING_TOP` | 12 | 다이제스트 아래 리스트 상단 |
| `SCREEN_LIST_CONTENT_PADDING_TOP` | 12 | 고정 UI 아래 리스트 상단 (다이제스트 없을 때) |
| `SCREEN_TAB_SCROLL_BOTTOM_BASE` | 12 | 홈·마켓·뉴스·시세 공통 탭 스크롤 하단 — **상단 리스트 pad와 동일** |

#### 탭 스크롤 하단 (의도)

- **모든 탭(홈·마켓·뉴스·시세)**: 마지막 행과 플로팅 탭바 사이 여유를 상단 헤더↔본문 gap(`SCREEN_LIST_CONTENT_PADDING_TOP` = 12)과 맞춘다. `tabScreenScrollBottomPadding(tabBarHeight, insets.bottom)`.
- **FAB**: 리스트 **위에 오버레이**. `paddingBottom`에 FAB `SIZE+GAP` 전체를 넣지 않는다 (`fabOverlayScrollCushion` — 기본 0). 넣으면 콘텐츠가 FAB 위에서 끊긴다.

상세 수치·헬퍼는 [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md#하단-스크롤-패딩)를 따른다. 리터럴 `16`·`paddingBottom` 합산을 화면에 직접 쓰지 않는다.

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
- 홈 섹션 **동일 래퍼** (`styles.section` + `COMFORT_GAP_PAGE` 사이 간격). heroStack으로 앞 섹션만 좁히지 않음
- 홈 섹션 제목 네이밍 (표시 타이틀 · API 키 유지):
  | 역할 | 제목 | API/데이터 |
  |---|---|---|
  | 히어로(마감 종합) | **정리** (EN Recap · JA まとめ) | `today_briefings` |
  | 히어로·시장 탭(회차) | **회차** (EN Sessions · JA セッション) | `market_briefings` |
  | 트렌드 | **트렌드** (`homeKeywordsTitle`) | digests·briefings `keywords` (없으면 topics 폴백) |
  | ETF 보조 | **섹터** (EN Sectors · JA セクター) | `etf_insights` |
  | 뉴스 이슈 | **뉴스** (EN News · JA ニュース) | news digests |
  | 캘린더 | **일정** | calendar |
  | 워치리스트 | **시세** | 주요 지수 → 관심 종목 → 코인(Admin `crypto_symbols` 상위) → 환율(달러·JPY · 와이드만 위안, 국기 아이콘) |
  - 홈 섹션 제목 앞: `HomeSectionLeadIcon` (트렌드 `trending-up` · 히어로 `reader` · 뉴스 `newspaper` · 일정 `calendar` · 바로가기 `apps` · 시세 `stats-chart` · 섹터 `grid`). 홈에서는 `AiBadge` 없음. 홈/리스트 표시명에 영문 혼용 금지
  - **홈 섹션 우측 메타**: 섹터 기준일 · 뉴스 `NEW` · 트렌드 as-of → `HomeSectionHeader` `meta` — **세션 태그(`BriefingSessionTag`)와 동일 칩**(bgElevated · hairline border · textMuted). 시세 as-of도 같은 칩을 레이어 라인 우측에. 뉴스 `NEW`는 최신 `generatedAt` **1시간 이내**일 때만 (`isHomeNewsFlowNew`)
  - **홈 섹션 순서**
  - **오늘**: **트렌드**(에이전트 keywords 합산 · 없으면 숨김) → 히어로 1장 → **뉴스**(없으면 숨김 · 빈 카드 없음) → 일정 칩 → **바로가기** → 시세(지수·종목·코인·환율) → (조건부) 섹터
  - **과거**: **트렌드**(없으면 숨김) → 히어로 1장 → **뉴스**(없으면 숨김) → 일정 칩(선택일) → **바로가기** → (조건부) 섹터 · 시세 숨김
  - **트렌드 UI**: 홈 **최상단**. 다른 섹션과 같이 `HomeSectionHeader` — 좌측 `trending-up-outline` + **트렌드** · 우측 as-of 칩(기여 소스 최신 `generatedAt`/`publishedAt`). 아래 **칩 카드**(`theme.greenBorder`·1px · wrap). 종목은 로고+라벨(국내=회사명·해외=티커). `why`는 a11y만. 없으면 숨김
  - **홈 바로가기** (`HomeShortcutsStrip`): 보드·시세·뉴스 세그먼트·일정·섹터 흐름·공시·설정을 **여러 개** 둘 수 있고 순서 변경 가능. 기본 보드(전체)·시세(관심)·뉴스(전체)·일정, 최대 6. My info → 표시 → **홈 바로가기**(개수 카드와 분리). 빈 선택이면 섹션 숨김.
    - **내비**: 탭 루트로 전환하지 않음. 폰은 root Stack(`/more-board`·`/watchlist`·`/home-news` 등) 백 헤더, wide는 `drillFrom: 'home'` + `WideSubpaneHeader`.
    - **타일 라벨** (`homeShortcutDisplay`, **한 줄**):
      1. 리프(일정·섹터·공시·설정) → 이름만
      2. 그룹 기본(보드 `all`) → **상위만** (`게시판`)
      3. 그 외 → **`상위·하위`** (중점 `·`, 공백 없음). 예: `시세·코인` · `뉴스·글로벌` · `게시판·세이브`
      4. 하위는 탭 정식명이 아니라 **홈 전용 짧은 표기** (`homeTile*` — 시세 ETF→ETF, Crypto→Coin, YouTube→영상/YT, 가상통화→コイン)
      5. 결합 길이 예산 초과 시 **하위만** (아이콘이 상위). 예산: 라틴 포함 12 / 그 외 8
    - **보드 숏컷 진입**: 상단 채널 메뉴 숨김 · `lockedSource` 고정. 헤더 제목은 전체→게시판, 채널→채널명. More·탭·사이드바 보드는 채널 메뉴 유지.
  - **홈 섹션 `>` 없음**: 목록·탭 탐색은 시장·시세·더보기·사이드바 등 **다른 메뉴**로
- **히어로 선택** (`domain/home/selectHomeHeroBriefing.ts`, KST): 기본 창 ~09:00 `us/overnight` · 09:00~12:10 `kr/morning` · 12:10~15:30 `kr/lunch` · 15:30~23:00 `kr/close` · 23:00~ `today_briefing`. **이미 올라온 더 늦은 회차가 있으면 그걸 우선** (예: 장중 `lunch`가 있으면 장전 `morning` 창이어도 장중). 없으면 **같은 날(`briefingDate`)** 더 이른 회차로만 폴백 — 다른 날짜 브리핑은 노출하지 않음. 과거일은 오늘 정리 → close → lunch → morning → overnight
- **오늘 정리**: headline·summary·keyPoints 중 읽을 내용이 있을 때만 히어로. 없거나 빈 페이로드면 후보에서 제외(장중 회차로 폴백). 히어로 자체가 없으면 섹션 숨김(빈 카드 없음)
- **홈 뉴스**: 선택일 다이제스트가 있을 때만 섹션 표시. 없으면 숨김(빈 카드·「준비 중」 없음 — 히어로·일정과 동일)
- **히어로·뉴스·ETF 탭**: 장중 → `/market-briefing` · 오늘 정리 → `/today-briefing` · 뉴스 행 → `/news-digest` · 섹터 흐름 → `/etf-insight` (알림과 동일 단건 상세)
- **홈에서 제거**: 장중 브리핑 회차 목록 · 게시판 (더보기) · 섹션 `>` 목록 드릴 · 히어로/ETF/뉴스 바텀시트
- **일정 칩**: 뉴스 흐름 아래. `D-2 FOMC`·`D-1 CPI` 식 3~5개(핵심 지표·FOMC/연준·휴장·관심 실적). 탭 → `/calendar`. **칩이 없으면 일정 섹션 자체 숨김**(빈 카드 없음)
- **투자 캘린더** (`app/calendar.tsx`): 날짜 내비 + 타입 필터(색 스와치) + **일별 리스트**. 카드는 타입/종목/임팩트 태그·제목을 한 줄로, 시각은 우측. 월 그리드는 컴팩트 시트로 선택(일정 있는 날 점 표시). 타입 색: 실적 green · 지표 blue · 연준 orange · FOMC danger · 휴장 muted.
- **공시 흐름**은 홈에 두지 않음 — 더보기 허브·와이드 사이드바 공시 탭에서 진입 (`/disclosure-flow`)
- **섹터 흐름 (주간) 노출**:
  - **메인 진입**: 더보기·사이드바·홈 숏컷 짧은 라벨 **섹터** (`moreHubEtfShort`). 홈 섹션·상세 헤더는 **섹터 흐름** (`homeEtfInsightTitle`) → `/etf-insights`. API 키는 `etf-insights` 유지
  - **홈**: 고정 섹션·빈 상태 금지. 선택일 기준 최신건이 **7일 이내**일 때만 (`shouldShowEtfBriefingOnHome`). 카드는 **타이틀**(없으면 summary · rotation `A → B`) 아래 히트맵. 카드 탭 → `/etf-insight` 상세
  - 발행 알림: ingest 푸시·알림함 (일상 발견 경로)
  - ingest 계약: [ETF-INSIGHT-AUTOMATION.md](./ETF-INSIGHT-AUTOMATION.md)
- **장중 브리핑 ↔ 섹터 흐름 보완 모델** (같은 시각 언어, 다른 레이어):
  | 역할 | 장중 브리핑 | 섹터 흐름 | 공유 UI |
  |---|---|---|---|
  | Lead | summary · overview | summary · rotation · key points | lead panel |
  | 시각 펄스 | **sectors → 리스트** (첫 행만 히트맵 색) | **heatmap → 히트맵** | 등락색 `heatFillColor` / ETF는 `ChangeHeatmapGrid` |
  | 섹터/테마 내러티브 | **섹터**(짧게): 섹터명 \| % (첫 행 heat) → why | **themes**: 테마명 \| 모멘텀 → 요약(텍스트만) | 동일 row 밀도 |
  | 종목/수급 플로우 | **companies** | **flow** (`flowHighlights`) | `SymbolIdentityChip` · 본문 말줄임 없음 · 출처=`SourceIconStack`+외부 링크 |
  | 맥락 | macro · sources | sources | — |
  - **종목 identity 칩** (`SymbolIdentityChip`): 로고 20 + 라벨(티커=`theme.green` / 이름=`theme.text`) · pad 4×8 · radius 8 · 배경 `theme.card`(섹션 `bgElevated` 카드 위 대비). **이름·로고는 API `symbolMeta`(DB `symbol_profiles`) 우선**, 로고 URL 없으면 글자 아바타. **해외(영문 티커)는 티커만** — 회사명 미표시. 국내 6자리는 회사명 병기. 시장 companies·ETF 수급·공시·뉴스 등 공통.
  - **종목 로고** (`SymbolLogo`): 이미지 파일을 앱에 두지 않는다. 서버 URL(`symbolMeta.logoUrl` · 코인 `imageUrl` · FX 국기)만 쓰고, 없으면 글자 아바타. 상세는 [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md) 종목 로고
  - **장중 브리핑 섹터 리스트**: 홈 「섹터 흐름」과 구분 — 본문 섹션 제목은 **섹터**. 히트맵 **순** 리스트. **첫 행만** `heatFillColor` 배경 + 등락 텍스트색. 종목·티커·로고는 섹터 행에 두지 않음(본문 why·**companies**에 맡김)
  - **ETF themes**: 로고·하단 메타 티커 없음. 요약 본문은 텍스트만(`ChangeTintedText`) — 티커 인라인 링크 없음
  - **ETF 빈 섹션 금지**: heatmap·themes·flows·sources·rotation·insights·summary는 값이 있을 때만 렌더. 이름/요약 없는 theme·title 없는 source는 제외
  - **섹터 중복 방지**: 첫 행 = 이름·%. 본문 = 해석 문장만 (`stripSectorSummaryQuotePreamble`)
  - 수급·종목 티커 탭 → 국내 Naver / 해외 Yahoo (`openFinanceSymbol`)
  - 섹터 `changePercent` 권장(정렬·채색). `symbol`은 ingest 보조(앱 섹터 UI에는 미표시). 없으면 summary에서 파싱
- 홈 설정(표시 탭, 카드 분리): **홈 바로가기**(하위 다중 선택·순서, 최대 6) · **홈 개수**(관심 종목·섹터 흐름·뉴스 흐름 — 홈 시세 섹션의 워치리스트 칸 수). 히어로·일정 칩은 자동
- 홈 시세 그리드: **지수 6**(S&P · 나스닥 · 다우 · 필라 · 코스피 · 니케이) → 관심 종목 → 코인(큐레이션 상위 · 폰 2·와이드 3) → **환율**. 레이어 라인은 `지수 ------------------- [종가]` (레이어명 맨 앞 · 앞쪽 캡 라인 없음 · 우측 as-of는 헤더 `NEW`와 동일 칩). 레이어 **종가**/**Close**는 해당 레이어 **모든** 지수·주식·FX가 마감일 때만(코인 제외). 혼재(일부만 마감)면 헤더는 상대시간·마감 종목명 아래에만 **종가**/**Close**/**終値**. 레이어 Close가 있으면 타일 Close는 생략. 폰 **2열** · 와이드(웹/iPad) **3열**. 지수·코인·환율 탭 → Yahoo Finance, 주식 탭 → 종목 상세. 지수 Job `market_quotes_indices`, 환율 Job `market_quotes_fx`(`USDKRW=X`·`JPYKRW=X`·`CNYKRW=X`). **환율 슬롯**: compact(폰) 달러·JPY · wide(PC) +위안. JPY는 표시만 **×100**(100엔당 원), 라벨은 `JPY`. 환율 아이콘은 국기(`flagcdn.com` US/JP/CN). 지수 타일 아바타 글리프는 추종 ETF 심볼(`SPY`·`QQQ`·`DIA`·`SOXX`·`069500`·`EWJ`); 로고 이미지는 서버 `symbolMeta.logoUrl`이 있을 때만. 지수·주식·환율 as-of/`quoteTime`은 Yahoo `regularMarketTime`(시세 시각) — Job 수집 시각 아님. FX는 신선 창 1시간(지수 6시간과 다름) — 그 이상·주말이면 종가 판정(Yahoo Closed와 맞춤, “N시간 전”·요일 종가 지양)
- 상세(`BriefingDetailShell` + `MarketBriefingBlock`·`TodayBriefingBlock`·`EtfInsightBlock`·`DigestDetailContent`·홈 히어로): 헤드라인·요약·섹터 why·종목·매크로·출처·키포인트 본문은 말줄임 없이 전체 표시. 섹터 = 히트맵순 리스트 + 첫 행 heat
- 홈 히어로(장중·오늘 정리) 헤드라인도 줄 수 제한 없음 (카드에서 전체 노출)
- 콘텐츠 카드는 구분선·간격으로 구조를 잡는다 — **좌측 accent 세로 바 없음**

## 피드·리스트·다이제스트

상호작용(PTR, chip, 폴링)은 [FEED-INTERACTION.md](./FEED-INTERACTION.md). 여기서는 **시각 구조**만 정리한다.

### 리스트

- 고정 UI는 `ListHeaderComponent`에 넣지 않는다 → `topFixed` 사용
- 그룹 카드: `UI_RADIUS_GROUPED_FEED`, 카드 간 `COMFORT_MARGIN_GROUP`
- 새 소식 chip: `FeedNewContentChip` — compact pill (soft tint · hairline). OTA와 구분. 리스트 바로 위

### 다이제스트 가로 스트립

- `WebHorizontalScrollStrip` — **자유 스크롤** (페이지 스냅·dots 금지)
- 다음 카드 peek: compact 36px / wide 2열 0.48 비율 (`digestStripLayout.ts`)
- 끝 refresh 타일: `DigestRefreshTail`
- 출처: 카드 우측 「출처」→ `DigestSourcesSheet` (인라인 펼치기 금지). 리스트·홈 `SourceIconStack`은 **최대 2**. ingest `sourceRefs`는 이슈당 **최대 3**(같은 출처 1건)

### 게시판 (Board)

- **탭·More·사이드바**: 상단 채널 세그먼트(전체/세이브/미주미)로 소스 전환. wide는 사이드바 서브탭.
- **홈 바로가기 드릴**: 채널 메뉴 없음·소스 고정(`BoardContent` `lockedSource`). 목록만 표시.

### 더보기 · My info

- **더보기** (`app/(tabs)/more.tsx`): **iPhone만** — 내 정보·공시·**섹터**(짧은 라벨)·게시판·**게임** 숏컷 + 참고 링크 + 광고. 설정 메뉴는 없음.
  - **게임**: 진입·새 게임 추가·합 트레일 규칙은 [GAME-CENTER.md](./GAME-CENTER.md).
- **웹·iPad 사이드바**: More 항목 없음. 순서 — 홈 · 뉴스 · 시장 · 시세 · 공시 · **섹터** · 게시판 · **게임** · **내 정보**. 설정은 내 정보 허브에서 진입.
- **My info** (`app/account.tsx`): 허브 — 환경 설정(표시·알림·뉴스·시세·개발 모드), 내 활동(알림), 계정(프로필·소셜 연동·비밀번호·약관).
- **퀵 설정** (`QuickSettingsSheet`): 헤더 우측 options 아이콘. 언어·화면 모드. 푸터 **More settings** → 전체 설정(pill 탭 표시, iPhone·iPad 동일).
- **설정** (`app/settings.tsx`): 탭 순서 `constants/settingsTabs.ts`.
  - **전체 설정**(퀵 설정·알림 등, `from≠account`): 상단 pill 서브탭 표시(iPhone·embedded iPad 공통).
  - **My info 드릴인**(`from=account` / `settingsFromAccount`): pill 숨김·단일 탭. wide는 `WideSubpaneHeader`(chevron→내 정보).
- **Wide 우측 pane**: 좌측 사이드바·상단 `SignalHeader` 고정, 우측만 페이지 교체. 드릴인 시에만 `WideSubpaneHeader`. 상세는 [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md#wide-우측-pane-내비-ipad--넓은-웹).
- **개발자 캡슐**: `DeveloperFooterDock` — More 탭 하단 탭바 위 Marcus·LinkedIn (개발 모드에서만, iPhone).

### 브리핑·다이제스트 단건 상세

공통: `BriefingDetailShell` — 헤더(뒤로+섹션명)는 숏컷·플로우와 동일. `dateBar` 없음. 본문 헤드라인 = 단건 제목, 바로 아래 시간 메타(`formatBriefingDetailTimeMeta`).

| 화면 | 진입 | 본문 블록 |
|---|---|---|
| 오늘 정리 | 홈 히어로 · 알림 | `TodayBriefingBlock` — lead(요약) · 핵심 포인트 · 출처 |
| 장중 브리핑 | 홈 히어로 · 알림 (`/market-briefing`) | `MarketBriefingDetailContent` → `MarketBriefingBlock` (시장 탭 허브와 분리) |
| ETF | 홈·리스트 · 알림 | `EtfInsightBlock` |
| 뉴스/공시 다이제스트 | 홈 뉴스 · 목록 · 알림 | `DigestDetailContent` — lead(요약) · 출처 · **텍스트 복사**(`DigestCopyTextButton`: 제목+요약) |

제목·요약은 `selectable` + 복사 버튼. 페이로드는 `formatDigestCopyText` (`domain/digests/copyText.ts`). 뉴스 피드 출처 시트(`DigestSourcesSheet`)에도 동일 버튼.

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
| `BriefingDetailShell` | 단건 상세 공통 셸 (공통 드릴 헤더 + 헤드라인 + 시간 메타) |
| `signalDrillStackOptions` | phone Stack 드릴 헤더 옵션 (chevron + 제목) |
| `QuickSettingsSheet` / `DigestSourcesSheet` | 바텀 시트 — `BOTTOM_SHEET_MAX_HEIGHT` 70% (스트립 출처·퀵 설정 등) |
| `ItNewsFeedPanel` | IT 뉴스 리스트 (`category=it`) |
| `WideSubpaneHeader` | wide 우측 pane **드릴인** — chevron + 제목 (`PhoneHeaderBackButton`) |
| `SignalFloatingTabBar` | iPhone 하단 탭 |
| `IpadSidebarScreen` | wide 스택 |
| `MasterDetailLayout` | 시세·공시 2-pane |
| `ThemedRefreshControl` | PTR |
| `UpdatePromptStrip` | chip·OTA strip |
| `WebWheelFlatList` / `WebWheelScrollView` | 웹 스크롤 |
| `FloatingGlassFab` | FAB (시세 관심 `+` · 뉴스 번역 · **iPhone 홈·시세 새로고침**) |
| 시세 관심 순서 | 행 **롱프레스**로 저장순 변경(≡ 핸들 없음 · 표시순=저장순). 스와이프 삭제와 병행 |
| 시세 ETF 그룹 | 저장순 유지 · 홈 시세와 같은 **라벨+구분선** 서브헤더 **지수 / 섹터 / 해외·매크로** (`etfGroups`) |
| 시세 지연 as-of | **헤더 밖** · 세그먼트와 리스트 **사이** 우측 칩 `지연 · 15분 전` / `Delayed · Close` (`quotesDelayedAsOf`, 홈 메타·레이어 as-of와 동일 end 정렬). 홈 시세 레이어와 동일 규칙 — 전부 종가→Close, 관심 혼재면 열린 시세 중 최신 상대시간 |

## 웹 스크롤바

앱 스크롤 뷰포트(`data-signal-scroll-viewport` 등)의 세로 스크롤바는 숨긴다. 휠·트랙패드로만 스크롤. 구현: `app/+html.tsx` 글로벌 CSS.

## 새 화면 체크리스트

교차 앱 공통 항목은 [APP-UI-PLAYBOOK.md §11](./APP-UI-PLAYBOOK.md#11-새-앱--새-화면-체크리스트). SIGNAL 화면 단위:

1. `useResponsiveLayout()` → `useTwoPane` 분기
2. Safe Area `edges` — [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md)
3. 고정 UI → `getScreenFixedHeaderStyles()` + `topFixed` (날짜 있으면 날짜 → 세그먼트)
4. 여백·하단 패딩 → `screenLayout` 헬퍼만 (탭 base 12 = 상단 리스트 pad / FAB 높이 예약 금지)
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
