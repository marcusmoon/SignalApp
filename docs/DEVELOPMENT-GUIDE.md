# SIGNAL 개발 가이드

앱·연동 코드 작성의 현재 기준이다. 에이전트 온보딩 요약은 [AGENTS.md](./AGENTS.md)를, UI 규칙은 [DESIGN-GUIDE.md](./DESIGN-GUIDE.md)를 함께 본다.

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
| **iPhone·iPad Safari 웹** | `appLaunchUrls` 있음 | **네이티브 iOS와 동일** — 스킴 → https → 인앱 폴백 |
| **iPhone·iPad** (`ios` 네이티브) | `openInAppBrowser: true` | 인앱 브라우저 |
| **iPhone·iPad** | `appLaunchUrls` 있음 | 스킴(`canOpenURL` 검증) → http(s) 유니버설 링크 → `Linking` → 인앱 폴백 |
| **Android** (네이티브) | `appLaunchUrls` 있음 | intent → 스킴 → https → `Linking` → 인앱 폴백 |

iPad 네이티브는 `Platform.OS === 'ios'`. iPad Safari는 `Platform.OS === 'web'`이지만 `isIosWebFamily()`로 네이티브와 **같은 앱 우선 정책**을 탄다.

공통 유틸: `utils/externalLinkPlatform.ts` (`isIosWebFamily`, `usesIosAppLinkPolicy`), `utils/externalLinkLaunch.ts`, `utils/openExternalLink.ts`

### 링크 정의 위치

| 용도 | 정의 | 열기 |
|---|---|---|
| 종목 상세 바로가기 | `utils/symbolExternalLinks.ts` → `buildSymbolExternalLinks()` | `SymbolDetailPane` → `openConfiguredExternalLink` |
| 더보기 숏링크 | `constants/referenceAppLinks.ts` | `utils/referenceLinkOpen.ts` → `openReferenceLink` |
| Yahoo·네이버·토스 단일 | `utils/yahooFinance.ts`, `naverFinance.ts`, `tossFinance.ts` | 각 `open*()` 헬퍼 |
| 유튜브 영상 | `utils/openYoutube.ts` | `youtubeWatchAppLaunchUrls` |
| 뉴스·공시 원문 | `NewsCard`, `disclosures` | 인앱 브라우저 직접 (피드 원문 전용) |

### 서비스별 launch 규칙 (네이티브·iOS Safari 웹)

| 서비스 | iPhone·iPad (네이티브·Safari 웹) | Android 네이티브 | 데스크톱·Android Chrome 웹 |
|---|---|---|---|
| Yahoo | `finance.yahoo.com` 유니버설 링크 | intent + https | webUrl만 (새 탭) |
| 네이버 | `naversearchapp://inappbrowser` + 중계 http | intent + 스킴 | webUrl만 |
| 토스 | `supertoss://` → 유니버설 링크 | intent + 스킴 | webUrl만 |
| Upbit·Binance | 스킴 → 유니버설 링크 | intent + 스킴 | webUrl만 |

### 새 외부 링크 추가 절차

1. `webUrl` 결정 (https)
2. 앱 연동 가능하면 `*AppLaunchUrls(webUrl)` 함수 추가 또는 기존 함수 재사용
3. `openInAppBrowser: true`는 **웹 전용** 서비스만 (Google Finance, Bloomberg 등)
4. iOS 스킴 추가 시 `app.json` → `LSApplicationQueriesSchemes`
5. Android 호스트·스킴은 `plugins/withAndroidExternalAppQueries.js`
6. **네이티브 manifest 변경 후 EAS/prebuild 재빌드 필요**

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
| 뉴스 | `app/(tabs)/news.tsx` |
| 공시 | `app/(tabs)/disclosures.tsx` |
| 시장 | `app/(tabs)/signal.tsx` |
| 시세 | `app/(tabs)/quotes.tsx` |
| 더보기 | `app/(tabs)/more.tsx`, `components/more/ReferenceLinksSection.tsx` |
| 종목 상세 | `app/symbol/[ticker].tsx`, `components/symbol/SymbolDetailPane.tsx` |
| 알림함 | `app/alerts.tsx`, [NOTIFICATION-INBOX.md](./NOTIFICATION-INBOX.md) |
| 외부 링크 | `utils/openExternalLink.ts`, `utils/externalLinkOpen.ts` |
| 레이아웃 상수 | `constants/screenLayout.ts` |
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
| [DESIGN-GUIDE.md](./DESIGN-GUIDE.md) | UI·테마·레이아웃 |
| [AGENTS.md](./AGENTS.md) | 에이전트 온보딩·캐시 표 |
| [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md) | 여백·Safe Area 상세 |
| [FEED-INTERACTION.md](./FEED-INTERACTION.md) | PTR·chip·digest |
| [SIGNAL-PRD.md](./SIGNAL-PRD.md) | 제품 방향 |
| [TODO.md](./TODO.md) | 후속 과제 |
