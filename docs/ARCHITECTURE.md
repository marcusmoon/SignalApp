# SIGNAL 아키텍처

## 앱 구조

| 경로 | 역할 |
|---|---|
| `app/` | Expo Router 화면 |
| `components/` | UI 컴포넌트 |
| `constants/` | 전역 테마, 탭, 공통 상수 |
| `contexts/` | Locale, Theme, OTA 등 React Context |
| `domain/` | 정렬, 분류, 시드, 순수 제품 규칙 |
| `integrations/` | Signal API, AdMob, Expo Updates 어댑터 |
| `services/` | AsyncStorage, 세션, 설정, 캐시 오케스트레이션 |
| `utils/` | 날짜, 링크, 표시 유틸 ([DATE-TIME.md](./DATE-TIME.md)) |
| `locales/` | ko/en/ja 문자열 |

앱 화면은 외부 서비스를 직접 호출하지 않는다. 모든 피처 데이터는 `integrations/signal-api/`를 통해 Signal Server에서 가져온다.

## 탭 구조

| 탭 | 화면 | 역할 |
|---|---|---|
| 홈 | `app/(tabs)/home.tsx` | 히어로·일정(선택일 행+다가올 칩)·뉴스 흐름·**바로가기**·(오늘) 시세·(7일 이내) 섹터 흐름. 공시 흐름은 더보기/공시 |
| 뉴스 | `app/(tabs)/news.tsx` | 글로벌·한국·코인·IT·YouTube 피드 (`YoutubeFeedPanel` 공유) |
| 공시 | `app/(tabs)/disclosures.tsx` | SEC/DART 공시 (미국·한국) |
| 시장 | `app/(tabs)/signal.tsx` | 시장 브리핑 — 미장·장전·장중·마감 |
| 시세 | `app/(tabs)/quotes.tsx` | 관심·인기·시총·코인 시세 |
| 더보기 | `app/(tabs)/more.tsx` | 내 정보·공시·ETF·게시판·게임 숏컷 |
| My info | `app/account.tsx` | 환경 설정·내 활동·계정 |

뉴스 탭 기본 세그먼트는 `all`(global+korea+crypto+it 합산, video 제외)이다. IT·YouTube는 각 세그먼트에서만 접근한다.

## 서버 구조

| 경로 | 역할 |
|---|---|
| `server/src/http/public/v1/` | 앱 공개 API |
| `server/src/http/admin/api/` | Admin API |
| `server/src/http/webStatic.mjs` | Expo web export를 `/web` 하위로 서빙 |
| `server/src/db/` | Postgres client, shape/repository helpers |
| `server/src/jobs/` | 수집·인사이트 Job |
| `server/src/providers/` | RSS, YouTube, calendar, LLM 등 provider |
| `server/src/public/admin/` | Admin 정적 UI |

## DB 원칙

- Postgres가 유일한 런타임 DB다.
- 스키마와 기본 운영 데이터는 Flyway migration으로 관리한다.
- 앱 공개 API에서 중복 제거와 최소 응답을 적용한다.
- Job lock TTL은 Job 설정 기준으로 관리한다.
- DB 접근은 Flyway migration + repository(`server/src/db/repositories/`) + Kysely(`server/src/db/kysely/`) 조합으로 확장한다. legacy raw SQL은 점진 이전한다.
- **날짜·시간**: instant는 UTC(`timestamptz`), API·ingest 규칙은 [DATE-TIME.md](./DATE-TIME.md)를 따른다. 캘린더만 `event_date`(시장 일자) + `event_at`(UTC) 이중 모델을 쓴다.

## 네이티브 구조

`ios/`, `android/`는 Expo prebuild 산출물이다. 재현 가능한 변경은 `app.config.js`와 `plugins/`에 둔다. Xcode에서 직접 빌드하더라도 native 수정은 config plugin으로 반영 가능해야 한다.
