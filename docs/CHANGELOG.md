# SIGNAL — 현재 스냅샷

이 문서는 **과거 날짜별 이력**을 남기지 않고, **현재 버전의 기능/구조/운영 기준**만 유지합니다.

## 앱 (Client)

- **로케일**: `locales/*`에 UI 문자열을 모으고, 화면/도메인에서 재사용한다.
- **데이터 경로**: 피처 데이터 HTTP는 **`integrations/signal-api/`** 만 사용한다. 응답 메모리 캐시는 **`integrations/signal-api/cache/*`** (뉴스·캘린더·컨콜·유튜브 등). 시세 탭 등 일부 TTL·보조 캐시는 **`services/cache/`** 와 설정 화면의 캐시 초기화와 연동한다.
- **도메인**: 뉴스 규칙 `domain/news`, 시세·심볼 시드 `domain/quotes`(예: US 심볼), 유튜브 큐레이션·핸들 `domain/youtube`, 컨콜/캘린더/시그널 등은 각 `domain/<영역>` 배럴로만 참조한다.
- **뉴스 UI**: `components/signal/NewsCard` — 해시태그·「원문 보기」푸터, 상대 시각은 **경과 시간** 기준(방금 / N분·시간 전; 로컬 날짜 전환과 무관). 뉴스 탭은 상단 헤더와 글로벌/코인/한국 세그먼트를 고정하고, 새로고침 시 현재 세그먼트 뉴스와 오늘의 시그널을 함께 최신화한다. 오늘의 시그널은 제목/헤더 영역을 눌러 접거나 펼 수 있고, 새 업데이트 안내는 오늘의 시그널 영역 아래, 세그먼트 탭 위에 표시한다.
- **오늘의 시그널**: 앱 첫 화면은 서버 `/v1/insights`가 내려주는 오늘 생성 인사이트가 있으면 최신 뉴스보다 위에 `오늘의 시그널` 카드로 보여준다. 홈 미리보기는 후보 여러 건을 받아 기기 관심종목과 맞는 신호를 우선 노출하고, 카드에는 왜 지금 봐야 하는지(`whyNow`), 다음 확인 포인트, 뉴스·유튜브·시세·실적 소스 구성을 함께 표시한다. 전체 리스트 화면은 인사이트 `generatedAt` 생성일 기준 날짜 선택/좌우 이동으로 과거 시그널을 조회하며, 관심종목만 보기로 개인 티커와 연결된 시그널만 좁혀 볼 수 있다. 같은 날짜의 반복 생성분은 브리핑/심볼별 최신 1건만 노출한다. 카드는 인사이트 생성에 쓰인 대표 기사/영상 원문으로 이동하고, 심볼 칩은 해당 종목 상세로 이동한다.
- **알림 후보 인박스**: 알림 화면은 실제 FCM 수신 내역과 별도로 서버 `/v1/insights?pushCandidate=true`가 내려주는 오늘의 시그널 알림 후보를 상단에 보여준다. 설정 > 알림에서 오늘의 시그널 후보 표시 여부와 관심종목만 보기 여부를 제어하며, `실적 알림만`이 켜져 있으면 실적 관련 후보만 남긴다.
- **관심 브리핑 / 종목 상세 역할**: 관심 브리핑은 기기 관심종목 전체를 요약하는 개인 대시보드이며, 상단 `오늘 체크포인트`에서 최우선 종목·최대 변동·가까운 실적/일정을 먼저 요약한다. 브리핑 상단 CTA는 서버가 생성한 `오늘의 시그널` 전체 화면으로 연결해 로컬 브리핑과 수집 인사이트의 역할을 분리한다. `오늘 볼 종목`은 별도 점수판과 종목 브리핑을 분리하지 않고, 점수·사유·가격 변동·대표 뉴스·실적 일정을 한 카드에 묶어 전체 관심목록 반복 나열을 줄인다. 시장 요약은 핵심 지수/매크로 행만 압축 표시하고, 주간 실적/매크로 일정은 가로 칩 대신 가까운 항목 중심의 세로 카드로 보여준다. 종목 상세는 한 종목의 가격·뉴스·실적·신호 요약을 드릴다운하는 화면이며, 로컬 계산 영역은 `종목 체크 점수`, 해당 티커의 서버 인사이트 영역은 `오늘의 수집 인사이트`로 구분해 보여준다. 두 화면의 신호 사유/등락 계산 표시는 `utils/signalDisplay` 공통 기준을 사용한다.
- **관심 브리핑 호출 구조**: 관심 브리핑 초기 로드는 시세 탭 관심종목과 시장요약 심볼을 `/v1/market-quotes` 1회로 합쳐 가져오고, 종목별 뉴스는 `/v1/news?symbols=AAPL,MSFT...` 배치 조회로 묶는다. 첫 화면 점수 계산에서는 별도 캔들 호출을 하지 않아 최대 관심종목 수에 비례해 호출이 폭증하지 않게 한다.
- **유튜브 탭**: 최신순/인기순 선택은 `/v1/youtube?sort=latest|popular`로 전달된다. `youtube_economy_latest` / `youtube_economy_popular` Job이 각각 최신/인기 수집 버킷을 저장하고, 같은 영상이 양쪽에 걸리면 `sortBuckets`로 함께 보관한다. 인기순은 인기 버킷이 있으면 우선 사용한 뒤 YouTube 조회수(`viewCount`) 기준으로 정렬한다.
- **시세 탭**: 관심·인기·시총·코인 리스트는 상단 세그먼트를 고정하고, 카드의 심볼/Yahoo/가격/등락 텍스트는 실제 iPhone 글자 렌더링에서도 줄 겹침이 나지 않도록 한 줄·줄임·최대 스케일 기준을 둔다.
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
- **인사이트 Job**: `insights_market_brief`는 저장된 뉴스·유튜브·시세·캘린더를 조합해 `market_brief` / `asset_signal` 형식의 인사이트를 생성하고 `insight_items`에 저장한다. 현재 MVP는 규칙 기반이며, 각 결과에는 `whyNow`, `sourceStats`, `signalDrivers`, `nextSteps`를 포함한다. `asset_signal`의 푸시 후보는 `pushMinScore`, 뉴스/영상/실적 촉매, 큰 가격 변동, 소스 믹스를 함께 보고 `pushCandidate`, `pushPriority`, `pushReason`, `pushTitle`, `pushBody`를 저장한다. Claude/OpenAI provider가 설정되면 LLM 호출에 필요한 provider/model 상태와 prompt 입력 데이터를 함께 보관한다.
- **인사이트 조회 기준**: 앱용 `/v1/insights`는 SQLite `insight_items` 테이블에서 날짜·종류·레벨·푸시 후보 조건으로 후보를 먼저 조회한 뒤, 클라이언트 시간대 기준 날짜와 브리핑/심볼별 최신 1건 규칙을 적용한다. 기본값은 클라이언트 시간대의 `오늘` 생성분이며, 어드민은 **오늘의 시그널** 화면에서 최근 7일/30일/전체 인사이트와 LLM 준비 상태, 연결 원문을 확인한다.
- **인사이트 모니터링**: 어드민 대시보드는 데이터 상태의 인사이트 카드와 별도로 `최근 시그널` 패널을 보여주며, 항목 상세 버튼은 오늘의 시그널 관리 화면을 해당 제목 검색 상태로 연다. 오늘의 시그널 관리 화면은 총 생성 수, 푸시 후보, 푸시 문구 준비, 원문 연결, 만료, LLM 준비 개수를 함께 보여준다.
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
