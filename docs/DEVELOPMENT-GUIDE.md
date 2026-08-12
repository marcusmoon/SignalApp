# SIGNAL 개발 가이드

앱·연동 코드 작성의 현재 기준이다. 에이전트 온보딩 요약은 [AGENTS.md](./AGENTS.md)를, UI 규칙은 [DESIGN-GUIDE.md](./DESIGN-GUIDE.md)·교차 앱 표준은 [APP-UI-PLAYBOOK.md](./APP-UI-PLAYBOOK.md)를 함께 본다.

## 실행·품질

```bash
npm install
npm run start          # Expo dev
npm run ios | android | web
npm run server:dev     # Signal Server
npm run verify         # typecheck + unit tests (CI와 동일)
```

## 검증·회귀 테스트

자주 깨지는 **순수 도메인 규칙**은 UI와 분리해 `domain/**/*.test.ts`로 고정한다. React Native 컴포넌트 E2E는 두지 않고, 상태 전이·라벨 규칙처럼 재현 가능한 단위만 잡는다.

| 명령 | 내용 |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Node `node:test` + `--experimental-strip-types` (`domain/**/*.test.ts`, `utils/**/*.test.ts`, `services/**/*.test.ts`) |
| `npm run verify` | typecheck → test (PR·`main` push CI: `.github/workflows/verify.yml`) |

회귀 추가 기준:

1. **같은 계열 버그가 2회 이상** 나왔거나, wide 서브탭·홈 라벨처럼 경합/예산 규칙이 있는 경우
2. 테스트는 **순수 함수**만 대상으로 한다 (`@/` 값 import·RN 의존 없이 상대 import; `import type`의 `@/`는 strip-types로 제거됨)
3. 실패 메시지에 증상(예: clear 후 선택 유실)을 남긴다
4. 앱이 `@/`에 묶인 규칙은 `*Raw` / `*Rules` 순수 모듈로 뽑아 테스트한다

현재 커버 (자주 깨진 계열):

| 모듈 | 회귀 초점 |
|---|---|
| `domain/sidebar/subTabsState` | wide 사이드바 서브탭 선택 하이라이트·clear 경합 |
| `domain/home/shortcutCompoundLabel` | 홈 숏컷 한 줄 `부모·자식` 라벨 예산 |
| `domain/home/homeHeroRules` | 빈 오늘 정리 히어로 제외 · KST 회차 창 |
| `domain/home/normalizeHomeShortcuts` | 숏컷 레거시 마이그레이션 · 최대 6 · `[]` 유지 |
| `domain/briefings/publishedIso` | 브리핑 상세 발행 시각 체인 |
| `domain/digests/createdAt` | 다이제스트 시각 fallback |
| `domain/etfInsights/etfHomeVisibilityRules` | ETF 홈 7일 게이트 |
| `domain/moreHub/normalizeMoreHubOrder` | More 허브 ETF→게시판 앞 · 게임→게시판 뒤 |
| `domain/games/sumTrail` | 합 트레일 퍼즐 로직 — [GAME-CENTER.md](./GAME-CENTER.md) |
| `domain/games/sudoku` | 스도쿠 생성·검증 |
| `domain/games/records` | 게임 통산 기록 이벤트 |
| `domain/games/progress` | 이어하기 스냅샷 파서 |
| `domain/news/feedFilters` | 뉴스 URL 중복 제거 · 페이지네이션 전진 |
| `domain/quotes/tintSignedChangeInText` | 본문 부호/% 틴트 · 비변동 % 제외 |
| `domain/heatmaps/changeHeat` | 히트맵 채색 강도 |
| `domain/quotes/ticker` | 티커·종목코드 검증 |
| `domain/quotes/changeColorConvention` | 한/미 등락 색 규칙 |
| `domain/quotes/constants` · `segmentOrder` · `listLimits` | 시세 탭 `watch`·`etf`·`coin` · 구 `popular`/`mcap`→`etf` 마이그레이션 |
| 시세 ETF 목록 순서 | `etf_symbols` 저장 순 (`QuotesContent`가 `symbols`로 조회·재정렬; segment-only는 `fetched_at` DESC) |
| 시세 코인 목록 | Admin `crypto_symbols`(Yahoo `BASE-USD`) → Job `market_coins_top` → `GET /v1/coins`가 `listPosition` 순 |
| 홈 코인 앵커 | `/v1/coins` 리스트 순 유지(`pickHomeAnchorCoinsFromList`) · compact 2 / wide 3 · 워치리스트 중복 제외. Yahoo chart는 marketCap 미제공이라 시총 재정렬하지 않음 |
| 홈 일정 칩 | `filterHomeCalendarEvents` — 핵심 macro(CPI/NFP 등)·FOMC/연준·휴장·관심 실적만. 칩 라벨은 `homeCalendarChipShortName` (`D-2 CPI`) |
| `domain/quotes/etfGroups` | ETF 연속 구간 헤더(지수·섹터·해외·매크로) |
| 시세 관심 드래그 | `QuotesContent` + `saveWatchlistSymbols` — 행 롱프레스로 저장순 변경 |
| `utils/wideOverlayRoute` | `/etf-insights` vs `/etf-insight` 경로 매칭 |
| `services/symbolLogo` | 서버 제공 URL만 · 없으면 글자 아바타 |
| `domain/symbols/symbolIdentity` · `symbolMetaDisplay` | 표시 심볼·회사명 정책 · API symbolMeta name/logo 선택 |

## 디렉터리 규칙

| 경로 | 역할 |
|---|---|
| `app/` | Expo Router 화면 |
| `components/` | UI 컴포넌트 |
| `constants/` | 테마·레이아웃·탭 등 전역 상수 |
| `contexts/` | Theme, Locale, OTA 등 |
| `domain/` | 정렬·분류·순수 제품 규칙 |
| `integrations/signal-api/` | **앱의 유일한 피처 HTTP 진입점** |
| `services/` | AsyncStorage, 세션, 설정, 배지 폴링 |
| `utils/` | 날짜, 외부 링크, 표시 헬퍼 |
| `locales/` | ko / en / ja 문자열 (`MessageId` 타입) |
| `plugins/` | Expo config plugin (네이티브 재현 가능 변경) |
| `server/` | API, Admin, Job, Postgres |

원칙:

- 앱은 **Signal Server만** 호출한다. Provider 키·수집은 서버/Admin.
- 화면별 HTTP 캐시(`listCacheRef` 등)를 두지 않는다 → API 캐시 레이어에 위임.

## Signal API·캐시

`integrations/signal-api/` + `cacheMode.ts`:

| 모드 | 호출 | 용도 |
|---|---|---|
| `signalCacheMode()` → `use` | 캐시 hit 시 네트워크 생략 | 탭 전환·재진입·필터 재선택 |
| `signalCacheMode(true)` → `bypass` | 항상 네트워크 | PTR, chip, 헤더 탭 새로고침 |

폴링·탭 배지(`feedUnreadBadges`, `*UnreadPreference`)는 id 확인만 `bypass`.

캐시 모듈·TTL 표: [AGENTS.md §피드 API 캐시](./AGENTS.md#피드-api-캐시). 설정의 **캐시 삭제** → `clearSignalApiCache()`.

## 피드 상호작용

PTR, 필터 시 scroll-to-top, chip, digest, 폴링 규칙: **[FEED-INTERACTION.md](./FEED-INTERACTION.md)** (단일 출처).

요약:

- PTR: rows 유지, 스크롤 위치 유지, `bypass`
- 필터·날짜 변경: `useScrollToTopOnChange`
- chip: scope별 독립 state, 폴링은 chip만 (자동 fetch 금지)
- digest: `topFixed`, PTR/chip과 동시 `bypass`

## 날짜·시간

[DATE-TIME.md](./DATE-TIME.md) — 서버 UTC, API ISO `Z`, 앱 표시는 로케일+기기 타임존.

- 앱: `utils/date.ts`
- 서버: `server/src/time/utc.mjs`

## 로컬라이제이션

1. `locales/ko.ts` · `en.ts` · `ja.ts`에 동일 키 추가
2. `MessageId` 유니온에 키가 반영되는지 확인
3. 화면: `const { t } = useLocale()` → `t('someKey')`
4. 날짜 표시는 `utils/date.ts` 헬퍼 사용 (직접 `toLocaleString` 지양)

## My info · 설정

- **My info** (`app/account.tsx`): 로그인 후 허브. 환경 설정은 `router.push({ pathname: '/settings', params: { tab, from: 'account' } })` (wide: `showSettings(tab, { drillFrom: 'account' })` → `settingsFromAccount`).
- **퀵 설정 → More settings**: `from` 없이 `/settings?tab=display` (wide: `showSettings('display', { drillFrom: 'home' })`). pill 탭 표시·탭 전환은 `switchSettingsTab`.
- **설정 탭 순서**: `constants/settingsTabs.ts` — `display` · `notifications` · `news` · `quotes` · `server`(개발 모드).
- **허브 메뉴 설명**(`accountHub*Desc`)과 설정 화면 lead(`settings*Lead`) 문구는 동일 의미로 유지한다.
- **소셜 연동**: 해제 전 확인 다이얼로그. 비밀번호 미설정 + 마지막 소셜이면 해제 불가([SOCIAL-AUTH.md](./SOCIAL-AUTH.md)). 서버 비활성 공급자는 목록에 「준비 중」으로 표시.

## 종목 로고

시세·뉴스·공시·브리핑 등에서 쓰는 심볼 아이콘. **로컬 에셋 파일로 관리하지 않는다.**

| 구분 | 우선 URL | 실패·미등록 시 |
|---|---|---|
| 주식·ETF | API `symbolMeta.logoUrl` (`symbol_profiles`; 서버가 Parqet URL 등을 저장) | 글자 아바타 (클라이언트 URL 합성 없음) |
| 코인 | `GET /v1/coins`의 `imageUrl` (Yahoo Job·CDN) · 가능하면 `symbolMeta.logoUrl` | 글자 아바타 |
| 홈 환율 | `flagcdn.com/w80/{us\|jp\|cn}.png` (`homeFxFlagImageUrl`) | 글자 아바타 (`USD`/`JPY`/`CNY`) |

표시명·코드도 동일하게 **`symbolMeta.name` / `symbolMeta.displaySymbol`** 을 우선한다. 레거시 `name`·티커 문자열만 쓰는 UI는 맞출 것. **해외 영문 티커는 회사명을 붙이지 않고 티커만** 보여 준다(`companyNameForSymbolUi` · `SymbolIdentityChip`). 국내 6자리 코드만 회사명 병기.

| 역할 | 경로 |
|---|---|
| DB·upsert·enrich | `symbol_profiles` · `server/src/symbols/symbolProfiles.mjs` · `symbolProfilesRepository.mjs` · `enrichSymbolMeta.mjs` · `ingestSymbolProfiles.mjs` |
| 공개 필드 | `symbolMeta: { market, symbol, displaySymbol, name, logoUrl }` |
| URL 후보·실패 캐시 | `services/symbolLogo.ts` (서버 URL만; `logoBaseSymbol`=`normalizeDisplaySymbol`) |
| 앱 name/logo 선택 | `domain/symbols/symbolMetaDisplay.ts` (`pickSymbolMetaName` · `pickSymbolMetaLogoUrl`) · `companyNameForSymbolUi` |
| UI | `SymbolLogo` (`imageUrl`=서버 logoUrl) · `SymbolIdentityChip` |
| 시세 행 매핑 | `domain/quotes/rows.ts` (`mapSignalQuoteToRow`) |

서버 저장·Job은 [SERVER.md](./SERVER.md) 「종목·코인 로고」.

## 홈 바로가기

UI 규칙은 [DESIGN-GUIDE.md](./DESIGN-GUIDE.md) 홈 섹션. 구현 위치:

| 역할 | 경로 |
|---|---|
| 모델·기본값·최대 6 | `constants/homeShortcuts.ts` · `domain/home/shortcuts.ts` |
| 타일·설정 라벨 | `domain/home/shortcutDisplay.ts` (`homeShortcutCompoundLabel`) |
| 홈 타일 짧은 하위 문구 | `locales/*` `homeTile*` (탭 `quotesSegment*` / `feedSegment*`와 분리) |
| 저장 | `services/homeShortcutsPreference.ts` (`@signal/home_shortcuts_v2`) |
| 홈 스트립 | `components/signal/HomeShortcutsStrip.tsx` (라벨 `numberOfLines={1}`) |
| 설정 UI | `app/settings.tsx` 표시 탭 — **홈 바로가기** 카드(개수 카드와 분리). 목록은 상위+정식 하위명 |

내비 (`showBoard` / `showWatchlist` / `showNewsFeed`, `drillFrom: 'home'`):

- **폰**: `/more-board?lock=1` · `/watchlist` · `/home-news` 등 — Stack 옵션은 `signalDrillStackOptions` 공통.
- **wide**: overlay + `WideSubpaneHeader`(스크롤 밖). 보드 숏컷은 `boardSourceLocked` / `BoardContent.lockedSource`.
- **단건 상세**도 동일 헤더: `BriefingDetailShell` + `chromeTitle`(섹션명). 본문 `headline` + `headlineMeta`(시간, `domain/briefings/detailTime.ts`).
- **타일 라벨**: 기본(all)→상위만, 그 외→`상위·하위`(짧은 `homeTile*`). 규칙 상세는 [DESIGN-GUIDE.md](./DESIGN-GUIDE.md) 홈 바로가기.

## 외부 링크

종목 상세·더보기·유튜브 등 **모든 외부 URL**은 아래 스택을 통한다. `Linking.openURL` / `WebBrowser`를 화면에서 직접 호출하지 않는다.

```
openConfiguredExternalLink(descriptor)   // utils/externalLinkOpen.ts
  → openExternalLink(webUrl, appLaunchUrls, options)   // utils/openExternalLink.ts
```

### Descriptor

```ts
type ExternalLinkDescriptor = {
  webUrl: string;
  appLaunchUrls?: string[];      // 앱·유니버설 링크 시도 목록
  openInAppBrowser?: boolean;    // 앱 시도 없이 인앱 브라우저만
};
```

### 열기 정책 (플랫폼별)

| 런타임 | 조건 | 동작 |
|---|---|---|
| **데스크톱 웹·Android Chrome** | `openInAppBrowser: true` | Signal 인앱 브라우저(오버레이) |
| **데스크톱 웹·Android Chrome** | 앱 연동 링크 (`appLaunchUrls`) | **새 탭** → 실패 시 인앱 브라우저 |
| **iPhone·iPad Safari 웹** | `appLaunchUrls` 있음 | Yahoo: 동일 탭 https(유니버설). 기타: 허용 스킴 → https **새 탭** |
| **iPhone·iPad** (`ios` 네이티브) | `openInAppBrowser: true` | 인앱 브라우저 |
| **iPhone·iPad** | `appLaunchUrls` 있음 | **커스텀 스킴 → https** 순. iOS 네이티브에서 `openURL(https)`만 단독으로 쓰면 유니버설 링크가 Safari로만 열리는 경우가 많아 스킴을 먼저 시도한다. 최종 폴백은 외부 브라우저 |
| **Android** (네이티브) | `appLaunchUrls` 있음 | intent → 스킴 → https → `Linking` → 인앱 폴백 |

iPad 네이티브는 `Platform.OS === 'ios'`. iPad Safari는 `Platform.OS === 'web'` + `isIosWebFamily()` — 네이티브와 달리 **커스텀 스킴 없이 https만** 시도한다.

#### 유니버설 링크(https) — 기대 동작 vs iOS 제약

많은 앱이 Associated Domains로 **https 딥링크**를 등록한다. 사용자가 Safari·메시지·메일에서 https를 탭하면 앱이 설치된 경우 앱으로, 없으면 브라우저로 열리는 것이 정상이다.

다만 **SIGNAL 네이티브 앱 안에서** `Linking.openURL(https)`로 같은 URL을 열면, iOS는 “다른 앱으로 보낸다”는 신호로 해석해 **대상 앱이 아니라 Safari(외부 브라우저)** 로 보내는 경우가 많다(RN·Apple 이슈로 알려짐). 그래서 Yahoo·네이버·토스 등은 **공식 커스텀 스킴을 먼저** 시도하고, 실패·미지원 시 **webUrl(https) → 외부 브라우저** 순으로 폴백한다. Android는 `intent://`에 `package`·`browser_fallback_url`이 있어 https만으로도 앱/웹 분기가 잘 된다.

공통 유틸: `utils/externalLinkPlatform.ts` (`isIosWebFamily`, `usesIosAppLinkPolicy`), `utils/externalLinkLaunch.ts`, `utils/openExternalLink.ts`

### 링크 정의 위치

| 용도 | 정의 | launch URL | 열기 |
|---|---|---|---|
| 종목 상세 바로가기 | `utils/symbolExternalLinks.ts` → `buildSymbolExternalLinks()` | `buildAppLaunchUrls({ webUrl, linkId })` | `SymbolDetailPane` → `openConfiguredExternalLink` |
| 더보기 숏링크 | `constants/referenceAppLinks.ts` | `buildAppLaunchUrls({ webUrl, linkId: item.id })` | `utils/referenceLinkOpen.ts` → `openReferenceLink` |
| 앱 연동 레지스트리 | `utils/externalLinkRegistry.ts` | id·host → `*AppLaunchUrls` 빌더 | 종목·더보기·`open*` 헬퍼 공통 |
| Yahoo·네이버·토스 단일 | `utils/yahooFinance.ts`, `naverFinance.ts`, `tossFinance.ts` | 레지스트리 위임 | 각 `open*()` 헬퍼 |
| 유튜브 영상 | `utils/openYoutube.ts` | `youtubeWatchAppLaunchUrls` | `openYoutube` |
| 뉴스·공시 원문 | `NewsCard`, `disclosures` | — | 인앱 브라우저 직접 (피드 원문 전용) |

### 앱 launch URL 레지스트리 (`externalLinkRegistry.ts`)

**새 링크·환경별 분기를 한곳에 모은다.** 종목 상세·더보기·서비스별 `open*()` 헬퍼는 `buildAppLaunchUrls`만 호출하고, iOS 스킴·Android intent·host별 규칙은 레지스트리와 provider 파일에만 둔다.

```ts
buildAppLaunchUrls({ webUrl, linkId?: 'yahoo' | 'naver' | 'toss' | ... })
```

- `linkId`가 있으면 `LINK_ID_BUILDERS`에서 빌더 조회 (더보기·종목 id와 동일)
- 없으면 `webUrl` host 자동 매칭 (`finance.yahoo.com`, `m.stock.naver.com`, `tossinvest.com` 등)
- 열기 순서·플랫폼 폴백은 `openExternalLink`가 처리 (레지스트리는 URL 목록만 반환)

등록된 id: `registeredAppLinkIds()` — Yahoo quote·earnings는 동일 빌더가 경로로 자동 분기.

### 서비스별 launch 규칙 (네이티브·iOS Safari 웹)

| 서비스 | iPhone·iPad 네이티브 | iPhone·iPad Safari 웹 | Android 네이티브 | 데스크톱·Android Chrome 웹 |
|---|---|---|---|---|
| Yahoo | `yfinance://finance.yahoo.com/`·경로 스킴 → https | **동일 탭 https** 유니버설 링크 (스킴 생략) | intent + https | webUrl만 (새 탭) |
| 네이버 | `naversearchapp://inappbrowser` → (폴백 https) | 스킴 시도 → 실패 시 https **새 탭** | intent + 스킴 | webUrl만 |
| 토스 | `supertoss://` → 유니버설 링크 | 스킴 시도 → 실패 시 https **새 탭** | intent + 스킴 | webUrl만 |
| Upbit·Binance | 스킴 → 유니버설 링크 | https 새 탭 | intent + 스킴 | webUrl만 |

### 새 외부 링크 추가 절차

1. `webUrl` 결정 (https) — `referenceAppLinks.ts` 또는 `symbolExternalLinks.ts`
2. **앱 연동 가능하면** `utils/externalLinkRegistry.ts`의 `LINK_ID_BUILDERS`에 id 한 줄 등록 (또는 host만으로 자동 매칭되면 생략)
3. 서비스별 스킴·intent 규칙이 필요하면 provider 파일에 `*AppLaunchUrls(webUrl)` 추가 후 레지스트리에서 참조 (Yahoo처럼 경로 자동 분기 가능)
4. 종목·더보기·`open*()`에서는 `buildAppLaunchUrls({ webUrl, linkId })`만 사용 — 화면별로 `*AppLaunchUrls` 직접 호출 금지
5. `openInAppBrowser: true`는 **웹 전용** 서비스만 (Google Finance, Bloomberg 등)
6. iOS 스킴 추가 시 `app.json` → `LSApplicationQueriesSchemes`
7. Android 호스트·스킴은 `plugins/withAndroidExternalAppQueries.js`
8. **네이티브 manifest 변경 후 EAS/prebuild 재빌드 필요**
9. `node scripts/verify-external-link-urls.mjs`로 launch URL 스모크 테스트

## 네이티브·빌드

- 재현 가능한 native 변경: `app.config.js`, `plugins/`, `app.json`
- EAS·OTA·Xcode: [EXPO-EAS-OPERATIONS.md](./EXPO-EAS-OPERATIONS.md)
- 소셜 로그인: [SOCIAL-AUTH.md](./SOCIAL-AUTH.md)

### 환경 변수 (앱)

`.env.example` 기준. 비밀·네이티브 키는 `EXPO_PUBLIC_*`로 노출하지 않는다.

| 변수 | 용도 |
|---|---|
| `EXPO_PUBLIC_SIGNAL_API_BASE_URL` | Signal Server |
| `EAS_PROJECT_ID` | EAS Update / push |
| `KAKAO_NATIVE_APP_KEY` | Kakao Native SDK |
| `SIGNAL_IOS_REMOTE_PUSH_ENABLED` | iOS push entitlement |
| `SIGNAL_IOS_APPLE_SIGN_IN_ENABLED` | Sign in with Apple |

## 서버·Admin

- 구조: [ARCHITECTURE.md](./ARCHITECTURE.md)
- 운영·Job·DB: [SERVER.md](./SERVER.md)
- Admin UI: [SIGNAL-ADMIN-UIUX.md](./SIGNAL-ADMIN-UIUX.md)

## 자주 보는 파일

| 기능 | 파일 |
|---|---|
| 홈 | `app/(tabs)/home.tsx`, `components/signal/HomeFocusContent.tsx`, `components/signal/HomeTrendHeroCard.tsx` |
| 시장 | `app/(tabs)/signal.tsx`, `components/signal/MarketBriefingBlock.tsx` |
| 뉴스 | `app/(tabs)/news.tsx`, `components/news/LegacyNewsFeedScreen.tsx` |
| 공시 | `app/(tabs)/disclosures.tsx` |
| 시세 | `app/(tabs)/quotes.tsx` — `/v1/market-quotes`는 DB only. 코인은 `/v1/coins`(Yahoo·`crypto_symbols`). 로고는 `imageUrl`([종목 로고](#종목-로고)). 국내는 Job `market_quotes_korea`(Yahoo·`korea_watchlist`)가 채움. 관심 추가는 심볼 포맷만 검증 |
| 종목 로고 | `components/signal/SymbolLogo.tsx`, `services/symbolLogo.ts` — [종목 로고](#종목-로고) · [SERVER.md](./SERVER.md) |
| 더보기 | `app/(tabs)/more.tsx`, `app/game-center.tsx`, `app/games/sum-trail.tsx`, `components/more/DeveloperFooterDock.tsx`, `constants/moreHubOrder.ts` |
| IT 뉴스 | `app/(tabs)/it-news.tsx`, `app/more-it-news.tsx`, `components/news/ItNewsFeedPanel.tsx` — `GET /v1/news?category=it` |
| 마감 브리핑 상세 | `app/today-briefing.tsx` (푸시 딥링크) |
| 뉴스·공시 다이제스트 상세 | `app/news-digest.tsx` · `app/disclosure-digest.tsx` (알림·푸시) |
| 홈 오늘 정리·장중·ETF | 히어로/카드 → 상세 (`today-briefing` · `market-briefing` · `etf-insight`). 뉴스 행만 `DigestSourcesSheet` |
| 퀵 설정 | `components/signal/QuickSettingsSheet.tsx`, `constants/bottomSheetLayout.ts` |
| 설정 | `app/settings.tsx` |
| My info | `app/account.tsx` |
| 종목 상세 | `app/symbol/[ticker].tsx`, `components/symbol/SymbolDetailPane.tsx` |
| 알림함 | `app/alerts.tsx`, [NOTIFICATION-INBOX.md](./NOTIFICATION-INBOX.md) |
| 외부 링크 | `utils/externalLinkRegistry.ts`, `utils/openExternalLink.ts`, `utils/externalLinkOpen.ts` |
| 레이아웃 상수 | `constants/screenLayout.ts`, `constants/screenFixedHeader.ts` |
| Signal API | `integrations/signal-api/` |

## 출시·자동화

| 문서 | 내용 |
|---|---|
| [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) | 출시 전 점검 |
| [NEWS-ISSUE-AUTOMATION.md](./NEWS-ISSUE-AUTOMATION.md) | 뉴스 이슈 ingest |
| [TODAY-BRIEFING-AUTOMATION.md](./TODAY-BRIEFING-AUTOMATION.md) | 오늘의 브리핑 |
| [MARKET-BRIEFING-AUTOMATION.md](./MARKET-BRIEFING-AUTOMATION.md) | 시장 브리핑 |

## 관련 문서

| 문서 | 내용 |
|---|---|
| [APP-UI-PLAYBOOK.md](./APP-UI-PLAYBOOK.md) | 다른 앱 이식용 UI 표준 |
| [DESIGN-GUIDE.md](./DESIGN-GUIDE.md) | UI·테마·레이아웃 |
| [AGENTS.md](./AGENTS.md) | 에이전트 온보딩·캐시 표 |
| [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md) | 여백·Safe Area 상세 |
| [FEED-INTERACTION.md](./FEED-INTERACTION.md) | PTR·chip·digest |
| [SIGNAL-PRD.md](./SIGNAL-PRD.md) | 제품 방향 |
| [TODO.md](./TODO.md) | 후속 과제 |
