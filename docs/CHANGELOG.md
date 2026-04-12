# SIGNAL — 변경 기록

**기준:** 앱·문서 스냅샷을 **1.0**으로 보고, 이 파일은 여기서부터 다시 쌓습니다.

## 1.0 (2026-04-12)

- **뉴스:** 글로벌 / 코인 / 한국 세그먼트, Finnhub 피드 + 한국 키워드 필터(`domain/news/`), 선택 시 Claude·OpenAI로 **제목 번역**(설정에서 제공자 선택).
- **시세·관심:** Finnhub 시세, 탭·목록 수·글래스 등 로컬 설정.
- **컨콜·캘린더:** 실적·일정 조회, 연도·분기 필터 규칙은 `domain/concalls/fiscal.ts`, 저장은 `services/concallFiscalFilter.ts`.
- **유튜브:** 큐레이션·검색 부스트는 `domain/youtube/economy.ts`, 앱에서 열기는 `utils/openYoutube.ts`.
- **레이어:** 비즈니스 규칙 `domain/`, 외부 API `integrations/<vendor>/`, 설정·오케스트레이션 `services/`, 범용 헬퍼 `utils/`.
- **문서:** `docs/`에 PRD·AGENTS·ARCHITECTURE·CHANGELOG 정리.
- 루트 **`AGENTS.md`** 는 위 문서로 가는 인덱스만 둔다.

이후 변경은 날짜 섹션 아래에 **무엇이 바뀌었는지** 한두 문단(또는 작은 목록)으로 적으면 됩니다.

## 2026-04-12 (레이어·문서·domain)

- **domain:** 뉴스·컨콜·유튜브·시세·테마·캘린더·더보기 허브 등 순수 규칙을 `domain/`에 모으고, `services`는 저장·re-export·오케스트레이션 위주로 정리.
- **문서:** PRD·CHANGELOG·AGENTS·ARCHITECTURE를 `docs/`로 이동, 루트 `AGENTS.md`는 인덱스만 유지.
- **lib:** 제거 — 유튜브 URL 규칙은 `domain/youtube/economy.ts`, 열기는 `utils/openYoutube.ts`.

### 파일별

| 파일 | 변경 내용 |
|------|-----------|
| `AGENTS.md` | `docs/` 문서로 연결하는 짧은 인덱스만 유지 |
| `docs/AGENTS.md` | 온보딩 본문 (경로·env·domain 목록 반영) |
| `docs/ARCHITECTURE.md` | 레이어 표·`domain` 예시 갱신 |
| `docs/CHANGELOG.md` | 본 파일 (루트에서 이동) |
| `docs/SIGNAL-PRD.md` | PRD (루트에서 이동) |
| `CHANGELOG.md` (루트) | 삭제 → `docs/CHANGELOG.md` |
| `SIGNAL-PRD.md` (루트) | 삭제 → `docs/SIGNAL-PRD.md` |
| `domain/calendar/eventTypeFilter.ts` | 신규 — 캘린더 이벤트 타입 필터 정규화·순서 |
| `domain/concalls/earningsRows.ts` | 신규 — 실적 행 정렬·FY 필터·스니펫·관심 심볼 집합 |
| `domain/concalls/fiscal.ts` | 신규 — 컨콜 연도·분기·캘린더 범위 순수 로직 |
| `domain/moreHub/order.ts` | 신규 — 더보기 허브 라우트 순서 정규화 |
| `domain/news/flash.ts` | 신규 — 뉴스 플래시(기존 `services/newsFlash` 대체) |
| `domain/news/koreaFilter.ts` | 신규 — 한국 뉴스 키워드 필터 |
| `domain/news/koreaKeywords.ts` | 신규 — 한국 추가 키워드 기본·정규화 |
| `domain/news/segmentOrder.ts` | 신규 — 뉴스 세그먼트 탭 순서 정규화 |
| `domain/quotes/listLimits.ts` | 신규 — 시세 목록 한도 상수·정규화·구버전 판별 |
| `domain/quotes/segmentOrder.ts` | 신규 — 시세 세그먼트 순서 |
| `domain/quotes/ticker.ts` | 신규 — 미국 티커 정규화·유효성 |
| `domain/theme/colorHex.ts` | 신규 — HEX 정규화·RGB 변환 |
| `domain/youtube/economy.ts` | 신규 — 유튜브 검색 부스트·시청 URL |
| `domain/youtube/handle.ts` | 신규 — 핸들 정규화·검증·중복 제거 |
| `app/(tabs)/index.tsx` | 뉴스 피드가 `domain/news`·관련 서비스 경로 사용 |
| `app/settings.tsx` | `domain`·`docs` 경로에 맞춘 import 정리 |
| `components/signal/ConcallFiscalFilterModal.tsx` | `@/domain/concalls/fiscal` import |
| `components/signal/YoutubeCard.tsx` | `@/utils/openYoutube` import |
| `components/EditScreenInfo.tsx` | 삭제 (템플릿 잔여) |
| `components/StyledText.tsx` | 삭제 (템플릿 잔여) |
| `components/__tests__/StyledText-test.js` | 삭제 |
| `integrations/anthropic/index.ts` | 연동 쪽 import/정리 |
| `integrations/youtube/index.ts` | `domain/youtube/economy` 사용 |
| `lib/openYoutube.ts` | 삭제 → `utils/openYoutube.ts` |
| `lib/youtubeEconomy.ts` | 삭제 → `domain/youtube/economy.ts` |
| `services/accentPreference.ts` | `domain/theme/colorHex` + re-export |
| `services/calendarEventTypeFilterPreference.ts` | `domain/calendar/eventTypeFilter` |
| `services/concallFiscalFilter.ts` | `domain/concalls/fiscal` + AsyncStorage |
| `services/concalls.ts` | `domain/concalls/earningsRows` 사용 |
| `services/moreHubOrderPreference.ts` | `domain/moreHub/order` |
| `services/newsFlash.ts` | 삭제 → `domain/news/flash.ts` |
| `services/newsKoreaFilter.ts` | 삭제 → `domain/news/koreaFilter.ts` |
| `services/newsKoreaKeywordsPreference.ts` | `domain/news/koreaKeywords` |
| `services/newsSegmentOrderPreference.ts` | `domain/news/segmentOrder` |
| `services/quoteWatchlist.ts` | `domain/quotes/ticker` |
| `services/quotesListLimitsPreference.ts` | `domain/quotes/listLimits` |
| `services/quotesSegmentOrderPreference.ts` | `domain/quotes/segmentOrder` |
| `services/youtubeCurationList.ts` | `domain/youtube/handle` |
| `utils/openReferenceLink.ts` | 삭제 |
| `utils/openYoutube.ts` | 신규 — 유튜브 카드에서 링크 열기 |
