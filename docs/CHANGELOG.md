# SIGNAL — 현재 스냅샷

이 문서는 **과거 날짜별 이력**을 남기지 않고, **현재 버전의 기능/구조/운영 기준**만 유지합니다.

## 앱 (Client)

- **로케일**: `locales/*`에 UI 문자열을 모으고, 화면/도메인에서 재사용한다.
- **데이터 경로**: 피처 데이터 HTTP는 **`integrations/signal-api/`** 만 사용한다. 응답 메모리 캐시는 **`integrations/signal-api/cache/*`** (뉴스·캘린더·컨콜·유튜브 등). 시세 탭 등 일부 TTL·보조 캐시는 **`services/cache/`** 와 설정 화면의 캐시 초기화와 연동한다.
- **도메인**: 뉴스 규칙 `domain/news`, 시세·심볼 시드 `domain/quotes`(예: US 심볼), 유튜브 큐레이션·핸들 `domain/youtube`, 컨콜/캘린더/시그널 등은 각 `domain/<영역>` 배럴로만 참조한다.
- **뉴스 UI**: `components/signal/NewsCard` — 해시태그·「원문 보기」푸터, 상대 시각은 **경과 시간** 기준(방금 / N분·시간 전; 로컬 날짜 전환과 무관).
- **오늘의 시그널**: 앱 첫 화면은 서버 `/v1/insights`가 내려주는 오늘 생성 인사이트가 있으면 최신 뉴스보다 위에 `오늘의 시그널` 카드로 보여준다. 카드는 인사이트 생성에 쓰인 대표 기사/영상 원문으로 이동한다.
- **Signal 서버 선택**: `.env`의 `EXPO_PUBLIC_SIGNAL_API_BASE_URL`은 번들 기본값이며, 앱 설정에서 `bundle / dev / real / custom` endpoint를 저장해 런타임에 바꿀 수 있다.
- **컨콜**: `services/concalls` 흐름과 앱 언어 기준 메시지; 서버 `/v1/concalls` 조회. 캐시 키에 로케일 포함.
- **앱 내 provider 클라이언트**: Finnhub·YouTube Data·OpenAI·Claude·CoinGecko 등 **직접 HTTP 클라이언트 폴더는 사용하지 않는다**. 타입·호환은 필요 시 `types/`·`utils/` 등으로만 둔다.

## 서버 (API / Jobs)

- **로컬 데이터**: Node 24 내장 SQLite 기반 embedded DB를 사용한다. 기본 경로는 `${DATA_DIR}/signal.sqlite`이며, Railway에서는 기존처럼 `DATA_DIR`를 볼륨 마운트 경로로 지정한다. `SQLITE_DB_PATH`로 파일 경로를 직접 지정할 수 있다.
- **DB 모듈 구성**: 공개 import 경로는 `server/src/db.mjs`로 유지하고, 내부 구현은 `server/src/db/`의 `defaults`, `shape`, `sqliteStore`, `adminUsers`, `newsSources`, `time` 모듈과 `server/src/db/sqlite/schema.mjs`로 나눠 관리한다.
- **초기 DB seed**: SQLite가 비어 있으면 `defaultDb()`를 저장해 기본 설정과 Job 리스트를 생성한다. 기존 `server/data/*.json` 분할 스토어와 과거 단일 `local-db.json`은 읽지 않는다.
- **어드민 사용자**: 로그인 계정은 SQLite `admin_users` 테이블에 저장한다. `ADMIN_USERS`는 테이블이 비어 있을 때만 초기 seed로 사용하며, 비밀번호는 salt + scrypt hash로 저장한다. **Admin > 설정 > 사용자 관리**에서 계정 추가·비밀번호 변경·활성화·삭제를 관리한다.
- **DB 테이블 구조**: 운영 데이터는 `signal_stores` 같은 통 payload가 아니라 기능별 SQLite 테이블(`polling_jobs`, `polling_job_runs`, `news_items`, `news_translations`, `calendar_events`, `concall_transcripts`, `youtube_videos`, `market_quotes`, `coin_markets`, `market_lists`, `provider_settings`, `translation_settings`, `news_sources`, `insight_items` 등)에 저장한다. 각 테이블은 대표 검색 컬럼과 payload를 같이 둬 추후 MySQL 전환 시 테이블 경계를 유지한다.
- **DB 접근 직렬화**: 동일 Node 프로세스 안에서 `readDb` / `writeDb` / `updateDb`는 큐로 **한 번에 하나씩** 실행된다. `updateDb`는 SQLite `BEGIN IMMEDIATE` 트랜잭션 안에서 읽기와 쓰기를 묶어 보정 수집·번역 갱신 같은 read/modify/write 경쟁을 줄인다.
- **스케줄(Jobs)**: 운영 액션은 어드민에서 수행하고, 실행/로그는 서버 데이터와 API를 통해 관리한다. 수동 실행 요청은 즉시 accepted로 응답하고 백그라운드 실행으로 이어지며, 어드민 실행 모니터링/실행 이력에서 진행률·경과 시간·무응답 시간·멈춤 의심 상태를 확인한다.
- **인사이트 Job**: `insights_market_brief`는 저장된 뉴스·유튜브·시세·캘린더를 조합해 `market_brief` / `asset_signal` 형식의 인사이트를 생성하고 `insight_items`에 저장한다. 현재 MVP는 규칙 기반이며, Claude/OpenAI provider가 설정되면 LLM 호출에 필요한 provider/model 상태와 prompt 입력 데이터를 함께 보관한다.
- **인사이트 조회 기준**: 앱용 `/v1/insights`는 기본적으로 클라이언트 시간대의 `오늘` 생성분만 반환한다. 어드민은 **오늘의 시그널** 화면에서 최근 7일/30일/전체 인사이트와 LLM 준비 상태, 연결 원문을 확인한다.
- **컨콜 Provider ID**: 컨콜 수집 provider와 seed 환경변수는 내부적으로 `ninjas` / `NINJAS_KEY`를 사용한다.
- **Financial Juice 뉴스**: RSS 제목의 `FinancialJuice:` 접두어는 수집·표시 단계에서 제거한다.
- **어드민 뉴스 목록**: 기본 날짜 범위는 최근 일주일로 두어 오늘 수집분이 없어도 최신 뉴스가 보이게 한다.
- **어드민 날짜 필터**: 뉴스와 Job 실행 이력의 `오늘/어제/기간` 필터는 어드민에서 선택한 시간대 기준 날짜로 적용한다.
- **어드민 대시보드**: 뉴스·캘린더·컨콜·유튜브·시세·코인별 저장 수, 마지막 데이터, 마지막 실행/성공, 최근 결과 건수와 품질 보조 지표를 한 화면에서 확인한다.
- **번역**: 로케일별 설정은 Provider 선택 중심이며, 실제 모델은 Provider 기본 모델을 따른다.
- **뉴스 해시태그**: 번역 provider는 `hashtags`를 반환할 수 있고, 서버는 자동/수동 태그를 뉴스 item에 저장해 `/v1/news`와 어드민 편집에 노출한다.

## 어드민 (Admin Console)

- **다국어(i18n)**: 정적 문자열은 `data-i18n`로, 동적 영역은 렌더링 시 `textFor`/`textForVars`로 처리한다.
- **언어 변경 반영**: 언어 변경 시 현재 화면의 동적 영역도 다시 렌더링/리로드되어야 한다.
- **뉴스 편집**: 목록은 원문 중심, 번역 확인/수정은 모달에서 `English(Original) / 한국어 / 日本語` 탭으로 처리한다.
- **사이드바 접기/펼치기**: 경계에 **투명 거터(gutter)**를 두고, hover 시 버튼을 노출한다(평소 숨김, 클릭 안정성 우선). **데스크톱(1024px 이상)** 에서만 적용한다.
- **모바일 레이아웃 (`admin.css` / `app.js`)**: `1024px` 미만은 본문 1열·사이드 **햄버거 드로어**(`fixed`, 오버레이). production 스타일의 2열·sticky 사이드는 `@media (min-width: 1024px)`에만 둬 모바일 규칙을 덮어쓰지 않게 한다. 드로어 안 메뉴는 **세로**(`navGroup` column).
- **모바일 헤더**: `flex-direction: column` — 1행 햄버거+브랜드(서브타이틀 숨김), 2행 `topTools`에서 글로벌 검색을 **전체 폭**으로 두고(`order`) 알림·도움말·프로필·언어·타임존·세션·로그아웃은 줄바꿈. 헤더 높이는 `ResizeObserver`로 재서 `--admin-header-h`에 넣고 드로어 `top`/`height`와 본문 `min-height`에 반영한다.
- **모바일 콘텐츠**: 검색·필터 일부는 접힘 패널·카드형 행 등 `docs/SIGNAL-ADMIN-UIUX.md` 기준을 따른다. 뉴스·수집 Job·실행 이력·유튜브 등 화면별 뷰는 해당 문서와 `server/src/public/admin/views/*`를 본다.
- **모바일 보조 이동**: 긴 화면에서 일정 거리 스크롤 시 하단 우측 `맨 위로` 플로팅 버튼(있는 화면).
- **Job 상태 표현**: 대시보드·실행 모니터링·실행 이력은 실패/실행 중/멈춤 의심/주기 초과 표시를 공통 규칙으로 렌더링한다. 상단 알림도 실패뿐 아니라 멈춤 의심과 주기 초과 Job을 함께 보여준다.
- **수집 메뉴 명명**: 좌측 수집 영역은 **콘텐츠 수집 관리**로 묶고, 하위 흐름은 `수집 Job` / `실행 모니터링` / `인사이트 결과` / `실패·오류 로그` 순서로 둔다.

## UI/UX 기준 문서

- **단일 기준**: 어드민 UI/UX의 현행 기준은 `docs/SIGNAL-ADMIN-UIUX.md`를 따른다.
