# SIGNAL — 아키텍처·레이어 (최신)

**Domain** = 제품 규칙만. 네트워크·벤더 키·URL 조립 없음.  
**Infrastructure** = Signal API HTTP·응답 캐시·AdMob·OS 어댑터 (`integrations/`).

이 문서가 **폴더 역할·상수 위치·훅·import 규칙**의 단일 기준이다. 명령·환경 변수·탭별 파일 연결은 **[AGENTS.md](./AGENTS.md)**.

---

## 1. 디렉터리 요약

| 경로 | 역할 |
|------|------|
| `app/` | expo-router 화면 (경로 = URL). |
| `components/` | UI. 판단이 두꺼우면 `domain/`으로. |
| `hooks/` | 여러 화면에서 쓰는 **공용 React 훅**. `index.ts` 배럴 → **`import { … } from '@/hooks'`**. |
| `contexts/` | React Context + **그 Provider와 짝인 훅** (`useLocale`, `useSignalTheme`, `useOtaBanner` 등). |
| `domain/` | 순수 규칙·정규화·분류. 아래 **「Domain」** 참고. |
| `integrations/` | Signal API client/cache, AdMob, OTA 어댑터. 아래 **「Integrations」** 참고. |
| `services/` | AsyncStorage·설정·오케스트레이션. Signal 서버 endpoint 선택과 캐시 on/off도 여기서 관리한다. 앱 피처 데이터 HTTP는 **`@/integrations/signal-api/...`** 만 사용. |
| `utils/` | 날짜·링크·`openYoutube` 등 범용 헬퍼. |
| `constants/` | **앱 전역** 정적 값만. 아래 **「루트 `constants/`」** 참고. |
| `locales/` | i18n (`ko` 키 기준 → `en`/`ja`). |
| `docs/` | PRD, AGENTS, 본 문서, 운영 스냅샷(CHANGELOG) 등. |

---

## 1.1 서버 HTTP 라우트 모듈 (`server/src/http/`)

- 서버의 HTTP 라우팅은 `server/src/http/index.mjs`가 엔트리이며, 아래처럼 **public/admin + 도메인별 파일**로 분리한다.
- `server/src/http.mjs`는 과거 경로 호환을 위한 **re-export shim**으로만 유지한다.

```text
server/src/http/
  shared.mjs              # json/text/readBody/paginate + filter*/displayNews 등 공용
  public/
    routes.mjs            # /health, /openapi.json, /docs, /v1/config
    v1/
      news.mjs            # /v1/news, /v1/news-sources
      market.mjs          # /v1/market-quotes, /v1/coins, /v1/market-lists, /v1/stock-*
      calendar.mjs        # /v1/calendar
      youtube.mjs         # /v1/youtube
      concalls.mjs        # /v1/concalls
  admin/
    static.mjs            # /admin + /admin/*.{js,css} + public assets
    auth.mjs              # /admin/api/{session,login,logout} + requireAdmin
    api/
      jobs.mjs            # jobs + runs + dashboard summary
      news.mjs            # news + translations + retranslate/delete
      calendar.mjs
      youtube.mjs
      concalls.mjs
      settings.mjs        # provider/translation/app/ui-presets/market-lists/news-sources
      dataReset.mjs
```

---

## 1.2 앱 라우팅 (`app/`)

- 화면 경로는 `expo-router` 규칙을 따른다(디렉터리 = URL).
- 화면에서 **네트워크 호출은 직접 하지 않고**, `@/integrations/signal-api/*`만 사용한다.

```text
app/
  (tabs)/                 # 탭 루트(뉴스/시세/유튜브 등)
  symbol/[ticker].tsx     # 종목 상세
  briefing.tsx            # 브리핑
  settings.tsx            # 앱 설정
  _layout.tsx             # 라우팅 레이아웃/공통 Provider
```

---

## 1.3 제품 규칙 레이어 (`domain/`)

- **순수 규칙**만 둔다. URL/HTTP/API Key/스토리지 같은 인프라 의존은 금지.
- 외부 노출은 각 도메인 루트의 `index.ts` 배럴을 통해서만 한다.

```text
domain/
  news/                   # 뉴스 규칙/정규화/키워드(예: 한국 뉴스)
  quotes/                 # 시세 세그먼트·US 심볼 시드 등
  youtube/                # 큐레이션 핸들·타입(HTTP 없음)
  calendar/               # 캘린더 규칙/표시 헬퍼
  concalls/               # 컨콜 표시/필터 규칙
  signals/                # 시그널 요약 규칙
  theme/                  # 테마 HEX 등
  moreHub/                # 더보기 허브 순서 등
```

---

## 1.4 인프라 레이어 (`integrations/`)

- 앱에서 HTTP를 하는 곳은 `integrations/signal-api/`만 허용한다.
- 과거용 `integrations/finnhub`·`integrations/youtube` **클라이언트 폴더는 제거**했다. 시세·뉴스 DTO는 API 타입(`integrations/signal-api/types` 등)과 맞춘다.

```text
integrations/
  signal-api/             # Signal Server API client + cache/ (news, calendar, concalls, youtube 등)
  admob/                  # 광고
  expo-updates/           # OTA 관련
```

---

## 1.5 기기·설정·오케스트레이션 (`services/`)

- AsyncStorage 기반 사용자 설정, 캐시 on/off, 워치리스트, 알림 등 **기기 상태**를 다룬다.
- “데이터를 어디서 가져오나”는 integrations(signal-api)이 담당하고, services는 **언제/어떤 조건으로 호출할지**를 조합한다.

```text
services/
  env.ts                              # EXPO_PUBLIC_* 런타임 env
  signalServerEndpoint.ts             # 번들/dev/real/custom Signal 서버 endpoint 선택
  cacheFeaturePreferences.ts          # 캐시 on/off
  cache/                              # 탭·피처 TTL, 설정 화면 캐시 클리어와 연동(예: quotes, news 레거시 엔트리)
  quoteWatchlist.ts                   # 관심종목
  marketSnapshotQuotes.ts             # 시세 탭 데이터 로딩 오케스트레이션(서버 API 기반)
```

---

## 1.6 서버 Provider / Jobs / 데이터 (`server/`)

- 서버는 외부 provider를 호출하고(키는 Admin에서 관리), 결과를 로컬 DB(`server/data/*.json`)에 저장한 뒤 `/v1/*`와 `/admin/api/*`로 제공한다.

```text
server/src/providers/       # 외부 provider 호출 + 정규화(예: market/finnhub, market/index, concalls/ninjas)
server/src/jobs/            # scheduler/runner (수집 작업)
server/data/                # settings/jobs/news/calendar/concalls/youtube/market 등 JSON 스토어
```

---

## 2. Domain (`domain/`)

- **배럴 import:** 화면·서비스에서는 **`@/domain/news`**, **`@/domain/quotes`** 처럼 영역 루트만 쓴다. `@/domain/news/koreaFilter` 같은 깊은 경로는 쓰지 않는다.
- **영역별 `constants.ts`:** 그 도메인의 기본 시드·탭 순서·숫자 기본값 등 **긴 리터럴·순서 상수**는 `domain/<영역>/constants.ts`에 둔다. 옆 모듈(`koreaKeywords.ts`, `segmentOrder.ts` 등)은 정규화·조합 로직을 담고, 필요하면 상수를 re-export 해 배럴에서 한 번에 노출한다.
- **예:** `domain/news/constants.ts` (한국 뉴스 추가 키워드 시드), `domain/quotes/constants.ts` (시세 세그먼트 키·목록 한도), `domain/calendar/constants.ts`, `domain/theme/constants.ts` (액센트 폴백 HEX).

---

## 3. Integrations (`integrations/`)

- **Signal API:** 앱 피처 데이터 HTTP는 `integrations/signal-api/`에서만 수행한다.
- **Provider client:** Finnhub·YouTube·OpenAI·Claude·CoinGecko·Ninjas 등 외부 provider HTTP는 서버가 담당한다. 앱에는 provider 클라이언트 폴더를 두지 않는다.
- **도메인 상수:** 큐레이션·심볼 시드 등은 `domain/youtube/constants.ts`, `domain/quotes/constants.ts` 등 **제품 규칙과 함께 갈 값**에 둔다.
- **`signal-api/index.ts`:** 외부에 노출하는 API·타입 re-export. `signal-api/cache/*`는 응답 캐시; 순환 참조 주의.
- **서버 측 시장 데이터:** 수집·정규화는 `server/src/providers/` (예: `market/finnhub`) — 앱은 `/v1/*`만 호출한다.

---

## 4. 루트 `constants/` vs 패키지 안 상수

| 둘 중 어디? | 기준 |
|-------------|------|
| **`constants/` (루트)** | 탭바·세그먼트 UI 공통, 브랜드 토큰, 뉴스 상단 세그먼트 키/순서처럼 **여러 레이어가 같이 참조**하는 앱 전역 값. 예: `theme.ts` (`SIGNAL`, `buildAppTheme`), `tabBarGlass.ts`, `newsSegment.ts`, `megaCapUniverse.ts`, `referenceAppLinks.ts`. |
| **`domain/<영역>/constants.ts`** | **그 도메인 규칙과 수명이 같을** 시드·순서·한도 숫자. |
| **`integrations/<vendor>/constants.ts`** (또는 벤더 `constants.ts` 일부) | **그 API·큐레이션과 같이 갈** 기본 심볼·채널 목록. |

루트 `constants/`를 없앨 필요는 없다. **“전부 한 폴더로만”** 모을 필수도 없다.

---

## 5. Hooks (`hooks/`)

- **역할:** 탭 포커스·리프레시 상태 보정, 테마 헬퍼 색 등 **UI·네비게이션 쪽 재사용 훅**.
- **배럴:** `@/hooks`에서 `useResetRefreshingOnTabBlur`, `useTabScreenLoadingRecovery`, `useColorScheme`, `useThemeColor`, `useClientOnlyValue` 등 export.
- **두지 않는 것:** 특정 Context와만 쓰는 훅은 **`contexts/`** 에 Provider와 함께 둔다.

---

## 6. `services/` vs `integrations/`

- **integrations:** Signal API HTTP, Signal API 응답 캐시, AdMob, OTA 어댑터.
- **services:** `env`, Signal 서버 endpoint 선택, 관심종목·알림·캐시 on/off 등 **기기·설정·오케스트레이션**. 새 피처 데이터 조회는 `@/integrations/signal-api/...`를 import한다.

---

## 7. 변경 시 문서

| 바꾼 범위 | 갱신 |
|-----------|------|
| 폴더 구조·레이어·상수 위치 | **본 문서** + 필요 시 `docs/AGENTS.md` §4 |
| 기능·동작 | `docs/CHANGELOG.md` (현재 스냅샷 갱신) |
| 제품 범위 | `docs/SIGNAL-PRD.md` |
