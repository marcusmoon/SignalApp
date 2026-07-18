# SIGNAL 개발 가이드

앱·연동 코드 작성의 현재 기준이다. 에이전트 온보딩 요약은 [AGENTS.md](./AGENTS.md)를, UI 규칙은 [DESIGN-GUIDE.md](./DESIGN-GUIDE.md)·교차 앱 표준은 [APP-UI-PLAYBOOK.md](./APP-UI-PLAYBOOK.md)를 함께 본다.

## 실행·품질

```bash
npm install
npm run start          # Expo dev
npm run ios | android | web
npm run server:dev     # Signal Server
npx tsc --noEmit
```

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
| 본문 entity 딥링크 | ingest `entities` + `domain/entities/linkEntitiesInText.ts` | `openEtfInsightSymbol` → Naver/Yahoo | `EntityLinkedTintedText` (`entities` prop). `ChangeTintedText`는 틴트 전용 별칭 |
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
| 홈 | `app/(tabs)/home.tsx`, `components/signal/HomeFocusContent.tsx` |
| 시장 | `app/(tabs)/signal.tsx`, `components/signal/MarketBriefingBlock.tsx` |
| 뉴스 | `app/(tabs)/news.tsx`, `components/news/LegacyNewsFeedScreen.tsx` |
| 공시 | `app/(tabs)/disclosures.tsx` |
| 시세 | `app/(tabs)/quotes.tsx` — `/v1/market-quotes`는 DB only. 국내는 Job `market_quotes_korea`(Yahoo·`korea_watchlist`)가 채움. 관심 추가는 심볼 포맷만 검증 |
| 더보기 | `app/(tabs)/more.tsx`, `components/more/DeveloperFooterDock.tsx`, `constants/moreHubOrder.ts` |
| IT 뉴스 | `app/(tabs)/it-news.tsx`, `app/more-it-news.tsx`, `components/news/ItNewsFeedPanel.tsx` — `GET /v1/news?category=it` |
| 마감 브리핑 상세 | `app/today-briefing.tsx` (딥링크·섹션 `>`) |
| 홈 오늘 정리 시트 | `components/signal/TodayBriefingSheet.tsx` (히어로 카드), 본문 `TodayBriefingBlock` |
| 홈 장중 브리핑 시트 | `components/signal/MarketBriefingSheet.tsx` (히어로 카드), 섹션 `>`는 시장 탭/화면 |
| 퀵 설정 | `components/signal/QuickSettingsSheet.tsx`, `constants/bottomSheetLayout.ts` |
| 설정 | `app/settings.tsx` |
| My info | `app/account.tsx` |
| 종목 상세 | `app/symbol/[ticker].tsx`, `components/symbol/SymbolDetailPane.tsx` |
| 알림함 | `app/alerts.tsx`, [NOTIFICATION-INBOX.md](./NOTIFICATION-INBOX.md) |
| 외부 링크 | `utils/externalLinkRegistry.ts`, `utils/openExternalLink.ts`, `utils/externalLinkOpen.ts` |
| 본문 entity 링크 | `domain/entities/linkEntitiesInText.ts`, `components/signal/EntityLinkedTintedText.tsx`, `domain/etfInsights/openSymbol.ts` |
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
