# Signal Server

Signal Server는 외부 provider 데이터를 수집하고, Postgres에 Signal 포맷으로 저장한 뒤 앱, 웹 클라이언트, Admin에 제공한다. 전체 운영 문서는 [`../docs/SERVER.md`](../docs/SERVER.md)를 본다.

## Run

저장소 루트에서 실행한다.

```bash
cp server/.env.example server/.env
npm run server:dev
```

열리는 주소:

- Health: `http://127.0.0.1:4000/health`
- Admin: `http://127.0.0.1:4000/admin`
- Web Client: `http://127.0.0.1:4000/web` (`npm run web:export`로 생성한 Expo web bundle이 있을 때)
- Web Client routes: `http://127.0.0.1:4000/web/news`, `http://127.0.0.1:4000/web/signal`
- OpenAPI: `http://127.0.0.1:4000/openapi.json`
- Docs: `http://127.0.0.1:4000/docs`

운영에서는 API와 worker를 분리한다.

```bash
npm --prefix server run start
npm run server:worker
```

API 서비스는 `SIGNAL_SCHEDULER_ENABLED=false`, worker 서비스는 `SIGNAL_SCHEDULER_ENABLED=true`로 둔다.

API 서버에 web client를 같이 올릴 때는 저장소 루트에서 build 단계에 아래를 실행한다.

```bash
npm run web:export
```

`npm run web:export`는 Expo의 `experiments.baseUrl`을 `/web`으로 설정해 HTML, JS route, asset URL을 모두 `/web/*` 기준으로 생성한다. 서버는 `server/src/public/web` bundle을 `/web`으로 서빙한다.

- Canonical web URL: `/web`, `/web/news`, `/web/quotes`, `/web/signal`
- Web asset URL: `/web/_expo/*`, `/web/assets/*`, `/web/favicon.ico`
- 호환 redirect: `/news`, `/quotes`, `/signal` 같은 기존 root 앱 경로는 `/web/news`, `/web/quotes`, `/web/signal`로 이동한다.

## Environment

핵심 변수:

- `DATABASE_URL`: Postgres 연결 문자열. Railway Postgres plugin의 URL을 사용한다.
- `HOST`, `PORT`: HTTP bind 주소와 port.
- `ADMIN_USERS`: `admin_users` 테이블이 비어 있을 때만 쓰는 초기 seed.
- `SIGNAL_JWT_PRIVATE_KEY_B64`: 앱 사용자 JWT 발급용 private key.
- `SIGNAL_SCHEDULER_ENABLED`: API/worker 실행 역할 분리.
- `SIGNAL_NOTIFICATION_SENDER_ENABLED`: worker의 알림 outbox 발송 루프.
- `SIGNAL_NOTIFICATION_PUSH_PROVIDER`: `mock` 또는 `expo`.
- `SIGNAL_HTTP_LOG_ALL`: 운영 기본은 `false`; 느린 요청과 오류만 로그로 남긴다.

Provider key는 env seed로 넣을 수 있지만, 일반 운영은 Admin 설정에서 관리한다.

- `FINNHUB_TOKEN`
- `YOUTUBE_API_KEY`
- `NINJAS_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `TRANSLATION_PROVIDER`
- `TRANSLATION_MODEL`

## Source Split

- `src/server.mjs`: HTTP API, Admin static/API, 로컬 개발용 scheduler.
- `src/worker.mjs`: scheduler + notification sender 전용 entrypoint.
- `src/http/`: public/admin HTTP route. 도메인별 파일로 분리한다.
- `src/jobs/`: 수집 job runner/scheduler.
- `src/providers/`: 외부 provider 호출과 정규화.
- `src/notifications/`: 알림 outbox sender.
- `src/db/`: Postgres client, Kysely helpers, feature repository, public query helper.
- `src/db.mjs`: DB 공개 facade. 외부 모듈은 이 파일을 우선 사용한다.

## Persistence

현재 런타임 저장소는 Postgres만 사용한다. 스키마와 기본 운영 데이터는 `server/db/migrations/postgres/V1__signal_baseline.sql` 기준이며, 새 환경은 서버 배포 전에 Flyway migration을 먼저 적용한다.

주요 테이블:

- 설정: `provider_settings`, `translation_settings`, `news_sources`, `market_lists`, `legal_terms`
- 수집/실행: `polling_jobs`, `polling_job_runs`, `polling_job_locks`
- 콘텐츠: `news_items`, `news_translations`, `calendar_events`, `youtube_videos`
- 시장 데이터: `market_quotes`, `coin_markets`
- 알림: `notification_items`
- 사용자: `admin_users`, `app_users`, `app_user_sessions`, `app_user_devices`, `app_user_identities`, `app_user_terms_acceptances`, `app_user_account_events`

새 DB가 비어 있으면 서버가 런타임 seed를 만들지 않는다. Job·Provider·RSS·시장 리스트·약관·캘린더 코드 매핑은 Flyway baseline seed에 포함된다.

## Operational Notes

- `/health`는 서버 응답과 Postgres 연결 가능 여부를 함께 확인한다.
- 앱 공개 API는 가능한 한 전체 DB 스냅샷을 만들지 않고 필요한 테이블만 조회한다.
- `polling_job_locks`는 API/worker 복수 프로세스에서 같은 Job 중복 실행을 막는다.
- 알림은 먼저 `notification_items`에 쌓이고, worker sender가 `queued -> sending -> sent/failed/skipped`로 전이한다.
- 실제 푸시 전송은 `SIGNAL_NOTIFICATION_PUSH_PROVIDER=expo`일 때만 수행한다. `mock`은 상태 전이 검증용이다.
