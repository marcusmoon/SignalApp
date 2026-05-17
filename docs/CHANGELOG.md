# SIGNAL — 현재 스냅샷

이 문서는 **과거 날짜별 이력**을 남기지 않고, **현재 버전의 기능/구조/운영 기준**만 유지합니다.

## 앱 (Client)

- **로케일**: `locales/*`에 UI 문자열을 모으고, 화면/도메인에서 재사용한다.
- **데이터 경로**: 피처 데이터 HTTP는 **`integrations/signal-api/`** 만 사용한다. 응답 메모리 캐시는 **`integrations/signal-api/cache/*`** (뉴스·캘린더·컨콜·유튜브 등). 시세 탭 등 일부 TTL·보조 캐시는 **`services/cache/`** 와 설정 화면의 캐시 초기화와 연동한다.
- **Signal API 요청 품질**: 앱의 Signal API 클라이언트는 요청에 기본 12초 타임아웃과 1회 재시도를 적용한다. 네트워크/타임아웃/서버 오류는 원문 body를 그대로 노출하지 않고 로케일별 안내 문구로 표시한다. 개발 빌드에서는 각 Signal API 응답 시간을 ms 단위로 로그에 남기고 1.2초 초과 요청은 slow 로그로 표시한다.
- **도메인**: 뉴스 규칙 `domain/news`, 시세·심볼 시드 `domain/quotes`(예: US 심볼), 유튜브 큐레이션·핸들 `domain/youtube`, 컨콜/캘린더/시그널 등은 각 `domain/<영역>` 배럴로만 참조한다.
- **뉴스 UI**: `components/signal/NewsCard` — 해시태그·「원문 보기」푸터, 상대 시각은 **경과 시간** 기준(방금 / N분·시간 전; 로컬 날짜 전환과 무관). 뉴스 탭은 상단 헤더와 글로벌/코인/한국 세그먼트를 고정하고, 새로고침 시 현재 세그먼트 뉴스와 오늘의 시그널을 함께 최신화한다. 오늘의 시그널은 제목/헤더 영역을 눌러 접거나 펼 수 있고, 새 업데이트 안내는 오늘의 시그널 영역 아래, 세그먼트 탭 위에 표시한다.
- **오늘의 시그널**: 앱 첫 화면은 서버 `/v1/insights`가 내려주는 오늘 생성 인사이트가 있으면 최신 뉴스보다 위에 `오늘의 시그널` 카드로 보여준다. 홈 미리보기는 후보 여러 건을 받아 기기 관심종목과 맞는 신호를 우선 노출하고, 카드에는 왜 지금 봐야 하는지(`whyNow`), 다음 확인 포인트, 뉴스·유튜브·시세·실적 소스 구성을 함께 표시한다. 전체 리스트 화면은 인사이트 `generatedAt` 생성일 기준 날짜 선택/좌우 이동으로 과거 시그널을 조회하며, 관심종목만 보기로 개인 티커와 연결된 시그널만 좁혀 볼 수 있다. 같은 날짜의 반복 생성분은 브리핑/심볼별 최신 1건만 노출한다. 카드는 인사이트 생성에 쓰인 대표 기사/영상 원문으로 이동하고, 심볼 칩은 해당 종목 상세로 이동한다.
- **알림 후보 인박스**: 알림 화면은 앱 계정 로그인을 요구한다. 로그인 후 서버 `/v1/notifications`의 사용자/전체 대상 알림과 실제 Expo Push 수신 내역을 함께 보여주고, 별도로 서버 `/v1/insights?pushCandidate=true`가 내려주는 오늘의 시그널 알림 후보를 상단에 보여준다. 앱은 로그인 세션과 알림 설정이 활성일 때 Expo push token을 `/v1/auth/devices`로 등록한다. 설정 > 알림에서 오늘의 시그널 후보 표시 여부와 관심종목만 보기 여부를 제어하며, `실적 알림만`이 켜져 있으면 실적 관련 후보만 남긴다.
- **관심 브리핑 / 종목 상세 역할**: 관심 브리핑은 기기 관심종목 전체를 요약하는 개인 대시보드이며, 상단 `오늘 체크포인트`에서 최우선 종목·최대 변동·가까운 실적/일정을 먼저 요약한다. 브리핑 상단 CTA는 서버가 생성한 `오늘의 시그널` 전체 화면으로 연결해 로컬 브리핑과 수집 인사이트의 역할을 분리한다. `오늘 볼 종목`은 별도 점수판과 종목 브리핑을 분리하지 않고, 점수·사유·가격 변동·대표 뉴스·실적 일정을 한 카드에 묶어 전체 관심목록 반복 나열을 줄인다. 시장 요약은 핵심 지수/매크로 행만 압축 표시하고, 주간 실적/매크로 일정은 가로 칩 대신 가까운 항목 중심의 세로 카드로 보여준다. 종목 상세는 한 종목의 가격·뉴스·실적·신호 요약을 드릴다운하는 화면이며, 로컬 계산 영역은 `종목 체크 점수`, 해당 티커의 서버 인사이트 영역은 `오늘의 수집 인사이트`로 구분해 보여준다. 두 화면의 신호 사유/등락 계산 표시는 `utils/signalDisplay` 공통 기준을 사용한다.
- **관심 브리핑 호출 구조**: 관심 브리핑 초기 로드는 시세 탭 관심종목과 시장요약 심볼을 `/v1/market-quotes` 1회로 합쳐 가져오고, 종목별 뉴스는 `/v1/news?symbols=AAPL,MSFT...` 배치 조회로 묶는다. 첫 화면 점수 계산에서는 별도 캔들 호출을 하지 않아 최대 관심종목 수에 비례해 호출이 폭증하지 않게 한다.
- **유튜브 탭**: 최신순/인기순 선택은 `/v1/youtube?sort=latest|popular`로 전달된다. `youtube_economy_latest` / `youtube_economy_popular` Job이 각각 최신/인기 수집 버킷을 저장하고, 같은 영상이 양쪽에 걸리면 `sortBuckets`로 함께 보관한다. 인기순은 인기 버킷이 있으면 우선 사용한 뒤 YouTube 조회수(`viewCount`) 기준으로 정렬한다. 서버 수집 채널은 Job별 `params.handles`가 아니라 Admin 앱 설정의 `youtubeCurationHandles`를 공통으로 사용한다. 앱은 뉴스 출처 필터와 동일하게 `/v1/youtube-channels`에서 필터 옵션을 받고, 사용자 선택값만 기기에 저장한다.
- **시세 탭**: 관심·인기·시총·코인 리스트는 상단 세그먼트를 고정하고, 카드의 심볼/Yahoo/가격/등락 텍스트는 실제 iPhone 글자 렌더링에서도 줄 겹침이 나지 않도록 한 줄·줄임·최대 스케일 기준을 둔다.
- **Signal 서버 선택**: `.env`의 `EXPO_PUBLIC_SIGNAL_API_BASE_URL`은 번들 기본값이며, 앱 설정에서 `bundle / dev / real / custom` endpoint를 저장해 런타임에 바꿀 수 있다.
- **출시 빌드 설정**: iPhone 중심 출시로 `ios.supportsTablet=false`를 기본으로 두고, iOS/Android 스토어 빌드 증분용 `buildNumber` / `versionCode`를 명시한다. Expo push token 발급용 `EAS_PROJECT_ID`는 `app.config.js`가 `extra.eas.projectId`로 주입하며, iOS 원격 푸시는 `SIGNAL_IOS_REMOTE_PUSH_ENABLED=1`인 TestFlight/App Store 빌드에서만 공식 `expo-notifications` 플러그인과 APNs entitlement를 켠다. 개인 Apple Team 로컬 빌드는 기존처럼 iOS remote push entitlement 없이 설치할 수 있다.
- **앱 내정보**: 하단 탭은 뉴스·유튜브·시세·더보기 4개를 유지하고, 내정보는 더보기의 개인 허브로 둔다. 로그인 전에는 소셜 계정 로그인을 기본 동선으로 보여주고 이메일 로그인은 보조 동선으로 둔다. 가입은 로그인 카드 하단의 별도 CTA로 진입하며, 서버 `/v1/legal/terms`에서 받은 언어별 서비스 이용약관/개인정보처리방침의 활성 최신 버전에 개별 동의(전체 동의 포함)를 먼저 받은 뒤 이메일/비밀번호/닉네임/프로필 이미지 URL 기본 정보를 입력해 완료한다. 소셜 계정이 SIGNAL에 처음 들어오는 경우에는 필수 약관 동의 후 같은 소셜 버튼으로 가입을 완료한다. 로그인 후에는 별도 상단 히어로 없이 프로필 편집, 알림함, 오늘의 시그널, 관심 브리핑, 알림 설정, 약관 동의 이력으로 이어지는 내 활동 링크와 하단 로그아웃/탈퇴/약관/푸터를 보여준다. 탈퇴는 앱 사용자 계정을 비활성화하고 세션·디바이스 푸시 대상을 해제하며, 이메일과 소셜 provider id는 tombstone 값으로 바꿔 같은 이메일/소셜 계정으로 재가입할 수 있게 한다. 카카오·네이버·구글·Apple 간편 로그인은 같은 서버 사용자/identity 구조에 붙이고, 앱 세션 토큰은 소셜 provider 토큰이 아니라 SIGNAL 서버가 발급한다. 내정보는 연결된 소셜 계정 목록과 연결 해제를 보여주며, 마지막 로그인 수단을 해제하려면 이메일 비밀번호를 먼저 설정해야 한다. 소셜 연결 해제는 provider id도 해제 전용 값으로 바꿔, 해제된 소셜 계정을 다른 활성 계정에 다시 연결할 수 있게 한다.
- **앱 알림 설정**: 사용자 설정 화면은 `푸시 알림`, `오늘의 시그널`, `관심종목만 받기`, `투자 일정 리마인더` 중심으로 단순화한다. 과거 `실적 알림만` 세부 옵션은 숨김 처리하고 기본적으로 해제해 오늘의 시그널 후보가 예기치 않게 필터링되지 않게 한다. 내부 저장 구조는 기존 `NotificationPrefs` 필드를 유지한다.
- **컨콜**: `services/concalls` 흐름과 앱 언어 기준 메시지; 서버 `/v1/concalls` 조회. 캐시 키에 로케일 포함.
- **앱 내 provider 클라이언트**: Finnhub·YouTube Data·OpenAI·Claude·CoinGecko 등 **직접 HTTP 클라이언트 폴더는 사용하지 않는다**. 타입·호환은 필요 시 `types/`·`utils/` 등으로만 둔다.

## 서버 (API / Jobs)

- **로컬 데이터**: Node 24 내장 SQLite 기반 embedded DB를 사용한다. 기본 경로는 `${DATA_DIR}/signal.sqlite`이며, Railway에서는 기존처럼 `DATA_DIR`를 볼륨 마운트 경로로 지정한다. `SQLITE_DB_PATH`로 파일 경로를 직접 지정할 수 있다.
- **Health check**: `/health`는 프로세스 응답뿐 아니라 SQLite read 가능 여부까지 확인한다. DB 확인에 실패하면 `503`과 `db.ok=false`를 반환해 Railway/운영 모니터링에서 readiness 문제를 감지할 수 있게 한다.
- **API 오류 노출 기준**: 예상치 못한 서버 500 오류는 내부 메시지를 클라이언트에 그대로 내려주지 않고 `INTERNAL_SERVER_ERROR`와 `requestId`만 반환한다. 상세 원인은 서버 로그의 같은 requestId로 추적한다.
- **DB 모듈 구성**: 공개 import 경로는 `server/src/db.mjs`로 유지하고, 내부 구현은 `server/src/db/`의 `defaults`, `shape`, `sqliteStore`, `adminUsers`, `newsSources`, `time` 모듈과 `server/src/db/sqlite/schema.mjs`로 나눠 관리한다.
- **초기 DB seed**: SQLite가 비어 있으면 첫 DB 연결 시 `defaultDb()`를 저장해 기본 설정과 Job 리스트를 생성한다.
- **어드민 사용자**: 로그인 계정은 SQLite `admin_users` 테이블에 저장한다. `ADMIN_USERS`는 테이블이 비어 있을 때만 초기 seed로 사용하며, 비밀번호는 salt + scrypt hash로 저장한다. **Admin > 설정 > 사용자 관리**에서 계정 추가·비밀번호 변경·활성화·삭제를 관리한다.
- **앱 사용자**: 앱 사용자는 SQLite `app_users`와 `app_user_sessions`에 저장한다. 기본은 이메일/비밀번호/닉네임/프로필 이미지 URL이며, `app_user_identities`는 카카오·네이버·구글 같은 소셜 identity 연결을 위한 확장 테이블로 둔다. 탈퇴, 소셜 연결, 소셜 연결 해제 같은 계정 생명주기 이벤트는 `app_user_account_events`에 append-only 히스토리로 남기고, 소셜 provider id는 원문 대신 해시로 추적한다. 푸시 토큰은 `app_user_devices`에 사용자 기준으로 저장할 수 있다. Admin은 **앱 사용자** 섹션을 시스템과 분리해 사용자 관리, 디바이스 관리, 알림 조회, 푸시/알림 발송 메뉴로 운영한다. 사용자 관리 화면은 상단 검색 필터와 사용자 리스트를 먼저 보여주고, 선택된 사용자에 대해 알림 이력·약관 동의 이력·디바이스 이력·인증 토큰 이력·소셜 계정·계정 이벤트를 하단 탭에서 확인한다.
- **약관 관리**: 서비스 이용약관과 개인정보처리방침은 SQLite `legal_terms`에 `type` / `locale` / `version` / `title` / `body` / `required` / `active` / `createdAt` / `updatedAt`로 저장한다. 같은 타입·언어에 여러 버전을 보관하고, 앱은 `/v1/legal/terms?locale=...`의 활성 최신 버전만 가입/약관 화면에 사용한다. 가입 시 서버는 해당 언어의 활성 필수 약관 버전 동의를 검증하고 `app_user_terms_acceptances`에 사용자별 동의 버전과 시각을 남긴다. 앱 내정보의 약관 동의 이력과 어드민 앱 사용자 상세에서 사용자별 동의 기록을 확인한다. 어드민은 **설정 > 약관**에서 약관 타입 탭과 언어 탭으로 제목·본문·버전·필수/활성 상태를 관리하고 버전 히스토리를 확인한다.
- **앱 인증/소셜 로그인**: SIGNAL 앱 세션은 이메일/비밀번호와 소셜 로그인 모두 서버가 발급한 JWT access token + refresh session 구조를 사용한다. 외부 소셜 provider 토큰은 identity 확인·연동에만 사용하고 앱 세션으로 저장하지 않는다. 카카오 네이티브 앱에서는 Kakao SDK access token을 서버에서 `/v2/user/me`로 검증한다. Kakao REST 콘솔 Redirect URI는 HTTPS만 허용되는 운영 제약이 있으므로 네이티브 앱의 Kakao 로그인은 `signalapp://oauth` REST fallback에 의존하지 않고, `.env`/EAS Secret의 `KAKAO_NATIVE_APP_KEY`로 prebuild/rebuild한 네이티브 SDK 경로를 사용한다. Kakao 로그인은 카카오톡 앱 경로를 먼저 시도하고, 실패하거나 응답이 멈추면 카카오계정 로그인으로 전환한다. Naver는 AuthSession code/state/redirectUri를 서버가 토큰 교환에 사용하고, Google은 id_token을 서버 JWKS 검증으로 확인하며, Apple은 iOS identity token과 최초 이름 힌트를 서버 identity에 반영한다. provider별 설정값과 콘솔 입력 위치는 `docs/SOCIAL-AUTH.md`에 둔다.
- **DB 테이블 구조**: 운영 데이터는 기능별 SQLite 테이블(`polling_jobs`, `polling_job_runs`, `news_items`, `news_translations`, `calendar_events`, `concall_transcripts`, `youtube_videos`, `market_quotes`, `coin_markets`, `market_lists`, `provider_settings`, `translation_settings`, `news_sources`, `insight_items`, `notification_items`, `app_users` 등)에 저장한다. 각 테이블은 대표 검색 컬럼과 payload를 같이 둬 추후 MySQL 전환 시 테이블 경계를 유지한다.
- **DB 접근 직렬화**: 동일 Node 프로세스 안에서 `readDb` / `writeDb` / `updateDb`는 큐로 **한 번에 하나씩** 실행된다. `updateDb`는 SQLite `BEGIN IMMEDIATE` 트랜잭션 안에서 읽기와 쓰기를 묶어 보정 수집·번역 갱신 같은 read/modify/write 경쟁을 줄인다.
- **공개 API 조회 성능**: 앱이 자주 호출하는 뉴스·뉴스 출처·유튜브·캘린더·컨콜·시세·코인·마켓 리스트·알림 조회는 전체 DB 스냅샷을 만드는 `readDb()` 대신 각 SQLite 테이블을 직접 조회한다. 대량 뉴스/유튜브/시세 payload가 쌓여도 서로 다른 API가 DB exclusive 큐에서 오래 대기하지 않게 한다.
- **스케줄(Jobs)**: 운영 액션은 어드민에서 수행하고, 실행/로그는 서버 데이터와 API를 통해 관리한다. 스케줄러는 due Job 확인 시 전체 DB 스냅샷을 만들지 않고 `polling_jobs`만 직접 조회하며, 같은 Node 프로세스 안에서 동일 Job의 중복 schedule 실행을 막는다. API 프로세스는 `SIGNAL_SCHEDULER_ENABLED=false`로 스케줄러를 끄고 worker 프로세스만 `npm run server:worker`로 운영할 수 있다. 실수로 둘 다 켜져도 SQLite `polling_job_locks`가 동일 Job의 중복 실행을 막는다. 수동 실행 요청은 즉시 accepted로 응답하고 백그라운드 실행으로 이어지며, 어드민 실행 모니터링/실행 이력에서 진행률·경과 시간·무응답 시간·멈춤 의심 상태를 확인한다.
- **느린 요청 로그**: 서버는 모든 HTTP 요청 시간을 메모리 메트릭으로 기록하고, 운영 로그는 기본적으로 느린 요청·오류만 남긴다. `SIGNAL_SLOW_REQUEST_MS` / `SIGNAL_VERY_SLOW_REQUEST_MS` 기준을 넘으면 `[http:slow]`, `[http:very-slow]` prefix로 남겨 Railway 로그에서 병목 API를 바로 찾을 수 있게 한다. 전체 요청 로그가 필요할 때만 `SIGNAL_HTTP_LOG_ALL=true`를 켠다.
- **API 응답 모니터링**: 서버는 최근 15분 HTTP 응답시간을 메모리 집계로 보관하고, 어드민 대시보드에서 요청 수·평균·p95·느린 요청·오류와 상위 느린 API를 확인한다.
- **인사이트 Job**: `insights_market_brief`는 저장된 뉴스·유튜브·시세·캘린더를 조합해 `market_brief` / `asset_signal` 형식의 인사이트를 생성하고 `insight_items`에 저장한다. 현재 MVP는 규칙 기반이며, 각 결과에는 `whyNow`, `sourceStats`, `signalDrivers`, `nextSteps`를 포함한다. `asset_signal`의 푸시 후보는 `pushMinScore`, 뉴스/영상/실적 촉매, 큰 가격 변동, 소스 믹스를 함께 보고 `pushCandidate`, `pushPriority`, `pushReason`, `pushTitle`, `pushBody`를 저장한다. Claude/OpenAI provider가 설정되면 LLM 호출에 필요한 provider/model 상태와 prompt 입력 데이터를 함께 보관한다.
- **알림 Outbox**: 알림은 인사이트 전용이 아니라 SQLite `notification_items` 테이블에 `type` / `channel` / `targetType` / `targetKey` / `appUserId` / `sourceType` / `status`를 가진 범용 outbox 레코드로 저장한다. 현재 지원 구조는 `insight_signal`, `app_update`, `service_notice`, `earnings_reminder`, `market_alert` 같은 타입을 전제로 하며, `insights_market_brief`가 생성한 `pushCandidate` 인사이트는 같은 실행 안에서 `channel=push`, `status=queued`, `type=insight_signal` 레코드로 적재한다. Admin API는 `/admin/api/notifications`에서 outbox 조회와 수동 생성을 지원하고, Admin > 앱 사용자에서는 전체/세그먼트 공지와 사용자별 알림 등록을 수행한다. 앱/어드민의 알림 조회·등록은 전체 DB 스냅샷을 복원하지 않고 `notification_items`를 직접 조회/업서트한다. Worker는 `SIGNAL_NOTIFICATION_SENDER_ENABLED=true`일 때 outbox sender를 함께 실행해 사용자/기기 기준으로 `queued` push 레코드를 `sending` 후 `sent`/`failed`/`skipped`로 전이한다. provider는 기본 `mock`이며, `SIGNAL_NOTIFICATION_PUSH_PROVIDER=expo`를 설정하면 Expo Push API로 발송한다.
- **인사이트 조회 기준**: 앱용 `/v1/insights`는 SQLite `insight_items` 테이블에서 날짜·종류·레벨·푸시 후보 조건으로 후보를 먼저 조회한 뒤, 클라이언트 시간대 기준 날짜와 브리핑/심볼별 최신 1건 규칙을 적용한다. 기본값은 클라이언트 시간대의 `오늘` 생성분이며, `from`/`to`가 지정되면 해당 날짜 범위를 우선 적용해 앱 날짜 선택 화면이 과거 시그널을 정확히 조회한다. 어드민은 **오늘의 시그널** 화면에서 최근 7일/30일/전체 인사이트와 LLM 준비 상태, 연결 원문을 확인한다.
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
