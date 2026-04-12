# SIGNAL — 변경 기록

**기준:** 앱·문서 스냅샷 **1.0**. 이전 날짜별 세부 이력은 **2026-04-12**에 본 문서로 **한 번에 정리**했다. 이후 변경은 **날짜 섹션**만 아래에 추가한다.

## 2026-04-12

### 제품·기능 (요약)

- **뉴스:** 글로벌·코인·한국 세그먼트, Finnhub 피드, 한국은 키워드 필터(`@/domain/news`). LLM 설정 시 **제목 번역**.
- **시세:** 관심·인기·시총·코인, Finnhub·Coingecko 연동, 탭 순서·목록 한도·글래스 등 로컬 설정.
- **컨콜·캘린더:** 실적·일정, `@/domain/concalls`·`@/domain/calendar`, API Ninjas·Finnhub 조합은 `services/concalls` 등 오케스트레이션.
- **유튜브:** 큐레이션·검색 부스트(`@/domain/youtube`), 기본 채널 시드는 `integrations/youtube/constants.ts`, 카드 링크는 `utils/openYoutube.ts`.
- **설정:** `app/settings.tsx` — 뉴스·유튜브·시세·캘린더·표시·알림.

### 코드·레이어 (요약)

- **`domain/`:** 뉴스·시세·컨콜·유튜브·테마·캘린더·더보기 허브 등 순수 규칙. **`@/domain/<영역>`** 배럴 import. 영역별 시드·순서는 **`domain/<영역>/constants.ts`**.
- **`integrations/<vendor>/`:** Finnhub·YouTube·Anthropic·OpenAI·AdMob·Coingecko·API Ninjas·expo-updates 등. 화면·서비스는 **`@/integrations/...`** 직접 import. 메모리 캐시는 통합 폴더 내 `*Cache.ts`. Finnhub는 `news`·`calendar`·`quotes`·`constants` 등으로 분리.
- **`services/`:** `env`, AsyncStorage 기반 설정, 오케스트레이션(레거시 re-export 최소화).
- **`hooks/`:** 공용 훅 + **`@/hooks`** 배럴. Context 전용 훅은 `contexts/`.
- **`constants/` (루트):** 테마 토큰(`SIGNAL`·`buildAppTheme`), 탭·세그먼트 UI, `newsSegment`, `megaCapUniverse` 등 **앱 전역** 정적 값.
- **문서:** `docs/SIGNAL-PRD.md`, `docs/AGENTS.md`, `docs/ARCHITECTURE.md`, 본 `CHANGELOG.md`. 레이어·상수·훅 규칙의 **단일 상세 기준**은 **`docs/ARCHITECTURE.md`**. 루트 `AGENTS.md`는 `docs/`로 연결하는 인덱스.

### 커밋 시

- **`docs/CHANGELOG.md`** 해당 날짜 아래에 **무엇이 바뀌었는지** 짧게 남긴다(필요 시 소규모 표).
