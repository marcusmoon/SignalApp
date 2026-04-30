# SIGNAL — 아키텍처·레이어 (최신)

**Domain** = 제품 규칙만. 네트워크·벤더 키·URL 조립 없음.  
**Infrastructure** = Signal API HTTP·AdMob·OS 어댑터·provider DTO/캐시 호환 모듈 (`integrations/`).

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
| `integrations/<vendor>/` | Signal API client, AdMob, provider DTO·상수·캐시 호환 모듈. 아래 **「Integrations」** 참고. |
| `services/` | AsyncStorage·설정·오케스트레이션. 앱 피처 데이터 HTTP는 **`@/integrations/signal-api/...`** 만 사용. |
| `utils/` | 날짜·링크·`openYoutube` 등 범용 헬퍼. |
| `constants/` | **앱 전역** 정적 값만. 아래 **「루트 `constants/`」** 참고. |
| `locales/` | i18n (`ko` 키 기준 → `en`/`ja`). |
| `docs/` | PRD, AGENTS, 본 문서, CHANGELOG 등. |

---

## 2. Domain (`domain/`)

- **배럴 import:** 화면·서비스에서는 **`@/domain/news`**, **`@/domain/quotes`** 처럼 영역 루트만 쓴다. `@/domain/news/koreaFilter` 같은 깊은 경로는 쓰지 않는다.
- **영역별 `constants.ts`:** 그 도메인의 기본 시드·탭 순서·숫자 기본값 등 **긴 리터럴·순서 상수**는 `domain/<영역>/constants.ts`에 둔다. 옆 모듈(`koreaKeywords.ts`, `segmentOrder.ts` 등)은 정규화·조합 로직을 담고, 필요하면 상수를 re-export 해 배럴에서 한 번에 노출한다.
- **예:** `domain/news/constants.ts` (한국 뉴스 추가 키워드 시드), `domain/quotes/constants.ts` (시세 세그먼트 키·목록 한도), `domain/calendar/constants.ts`, `domain/theme/constants.ts` (액센트 폴백 HEX).

---

## 3. Integrations (`integrations/`)

- **Signal API:** 앱 피처 데이터 HTTP는 `integrations/signal-api/`에서만 수행한다.
- **Provider client:** Finnhub·YouTube·OpenAI·Claude·CoinGecko 등 외부 provider HTTP는 서버가 담당한다. 앱의 provider 폴더는 타입·상수·캐시 호환 레이어로만 사용한다.
- **패키지별 `constants.ts`:** 그 연동·앱 기본 시드에 묶인 상수 (예: `integrations/youtube/constants.ts` — 기본 큐레이션 핸들). Finnhub처럼 **이미 큰 `constants.ts`가 있는 벤더**는 관심 종목 시드 등을 그 파일 안에 두어도 된다 (`DEFAULT_US_WATCHLIST` 등).
- **`index.ts`:** 외부에 노출하는 API·타입 re-export. 캐시 모듈은 순환 참조 주의.
- **예 (Finnhub):** `types.ts`, `constants.ts`, `quoteUtils.ts`, `*Cache.ts`는 앱 호환용. 실제 수집·provider 호출은 서버 provider가 담당한다.

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

- **integrations:** Signal API HTTP, AdMob, 메모리 캐시, provider DTO·상수 호환 모듈.
- **services:** `env`, 관심종목·알림·캐시 on/off 등 **기기·설정·오케스트레이션**. 새 피처 데이터 조회는 `@/integrations/signal-api/...`를 import한다.

---

## 7. 변경 시 문서

| 바꾼 범위 | 갱신 |
|-----------|------|
| 폴더 구조·레이어·상수 위치 | **본 문서** + 필요 시 `docs/AGENTS.md` §4 |
| 기능·동작 | `docs/CHANGELOG.md` |
| 제품 범위 | `docs/SIGNAL-PRD.md` |
