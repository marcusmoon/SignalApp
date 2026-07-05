# Signal Server 운영

## 실행

```bash
npm run server:dev
npm --prefix server run start
npm --prefix server run worker
```

## 주요 환경 변수

| 변수 | 설명 |
|---|---|
| `DATABASE_URL` | 런타임 Postgres 연결 문자열 |
| `HOST` | 서버 bind host |
| `PORT` | 서버 port |
| `ADMIN_USERS` | `admin_users`가 비어 있을 때만 넣는 초기 Admin 사용자 JSON |
| `SIGNAL_JWT_PRIVATE_KEY` | 앱 사용자 JWT private key PEM |
| `SIGNAL_JWT_PRIVATE_KEY_B64` | 앱 사용자 JWT private key base64 |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | LLM provider 키 |
| `YOUTUBE_API_KEY` | YouTube 수집 키 |
| `NINJAS_KEY` | Ninjas provider 키(레거시; 현재 미사용) |
| `SEC_USER_AGENT` | SEC EDGAR API 식별 User-Agent |
| `SIGNAL_AUTOMATION_INGEST_TOKEN` | 외부 자동화가 `/v1/market-briefings/ingest` webhook으로 브리핑을 적재할 때 쓰는 토큰 |
| `SIGNAL_JOB_LOCK_TTL_MS` | Job lock 기본 TTL(ms). Job별 `lockTtlSeconds`가 없을 때 사용 |
| `SIGNAL_JOB_LOCK_MAINTENANCE_MS` | 만료 lock·orphaned run 정리 주기(ms, 기본 60000) |

## DB 운영 원칙

- Postgres가 유일한 런타임 DB다.
- SQLite 파일, SQLite mirror, 백필 경로는 사용하지 않는다.
- 기본 Job, Provider, RSS, 시장 리스트, 약관은 Flyway migration으로만 관리한다.
- 서버 런타임은 기본 운영 데이터를 자동 생성하지 않는다. 새 환경은 서버 배포 전에 Flyway가 먼저 성공해야 한다.
- `ADMIN_USERS`는 `admin_users` 테이블이 비어 있을 때만 초기 관리자 계정으로 들어간다.
- Postgres 연결은 세션 `timezone=UTC`를 사용한다. instant 컬럼 필터·ingest 규칙은 [DATE-TIME.md](./DATE-TIME.md)를 따른다.

## Flyway 프로세스

DB 변경이 필요한 작업은 배포보다 Flyway가 먼저다.

1. `server/db/migrations/postgres/`에 새 migration을 추가한다.
2. 로컬 또는 운영 대상 Postgres에 Flyway를 먼저 실행한다.
3. migration 성공을 확인한 뒤 서버를 배포한다.
4. `/health`에서 `activeStore=postgres`, `db.postgres.ok=true`를 확인한다.

기본 운영 데이터 변경도 코드 seed가 아니라 새 Flyway migration으로 추가한다. 기존 운영자가 바꾼 설정을 덮어야 하는 경우에만 명시적으로 `ON CONFLICT DO UPDATE`를 사용하고, 기본값 추가는 `ON CONFLICT DO NOTHING`을 기본으로 한다.

### Baseline migration (V1 squash)

2026-06 기준으로 과거 `V1`–`V29` migration은 `V1__signal_baseline.sql` 하나로 합쳤다. Flyway 경로에는 이 파일만 둔다. 재생성용 원본은 `server/db/migrations/_archive/postgres/`에 보관한다.

**기존 DB를 전부 초기화할 때** (스키마·시드·ingest 데이터 삭제):

1. 서버·worker를 중지한다.
2. Postgres DB를 drop/create하거나 `flyway clean` 후 `migrate`한다. (`clean`은 모든 객체를 지우므로 운영에서는 DB 단위 재생성을 권장한다.)
3. `flyway migrate`로 `V1__signal_baseline.sql`만 적용한다.
4. Admin에서 provider API 키를 다시 입력한다. (`apiKey`는 migration seed에 빈 문자열)
5. 필요 시 `ADMIN_USERS`로 초기 관리자를 넣고 서버·worker를 기동한다.

새 환경은 위 3–5만 수행하면 된다. Job·RSS·시장 리스트·약관·캘린더 코드 매핑은 baseline seed에 포함되며, 뉴스·공시·캘린더 이벤트 등 ingest 본문은 Job 실행 후 쌓인다.

설정 예시는 `server/db/flyway.conf.example`에 둔다. 실제 접속 정보가 들어가는 `server/db/flyway.conf`는 git에 커밋하지 않는다.

```bash
flyway -configFiles=server/db/flyway.conf migrate
```

직접 인자를 줄 때:

```bash
flyway \
  -locations=filesystem:server/db/migrations/postgres \
  -url="jdbc:postgresql://HOST:PORT/DB?sslmode=require" \
  -user="USER" \
  -password="PASSWORD" \
  migrate
```

## 스키마 원칙

- 공개 API에서 자주 필터링하는 값은 typed column으로 둔다.
- provider 원본 응답과 유연한 필드는 `payload jsonb`에 보관한다.
- `news_items`, `youtube_videos`, `calendar_events`, `market_quotes`, `price_series`, `insight_items` 등 공개 API 조회 테이블은 날짜/카테고리/심볼 인덱스를 가진다.
- Job lock은 `polling_job_locks`에서 관리한다. 전체 DB 쓰기는 lock row를 지우지 않도록 upsert 중심으로 동작한다.
- DB abstraction은 JPA식 entity ORM보다 repository + typed SQL/query builder 방향으로 관리한다.
- Flyway가 스키마 변경의 기준이며, Kysely는 런타임 query builder로만 사용한다. Kysely schema 생성/migration은 사용하지 않는다.
- 신규 DB 접근은 `server/src/db/repositories/`에 기능별 repository로 추가한다. 기존 raw SQL은 성능 민감도와 변경 리스크가 낮은 영역부터 점진적으로 Kysely로 옮긴다.

## API 그룹

| 그룹 | 경로 |
|---|---|
| 공개 | `/v1/news`, `/v1/youtube`, `/v1/market-quotes`, `/v1/market-briefings`, `/v1/today-briefing`, `/v1/calendar`, `/v1/insights` |
| 인증 | `/v1/auth/*`, `/v1/notifications`, `/v1/legal/terms` |
| Admin | `/admin/api/*` |

## Job 운영

Admin에서 Job을 등록하고 실행한다. Job은 **영역(area) × 단계(stage)** 로 묶여 표시되며, `sync` operation Job은 한 번의 실행에서 수집과 보정을 연속 수행한다.

- **area**: `news`, `calendar`, `youtube`, `market`, `signal`, `legacy`
- **stage**: `ingest`(수집), `enrich`(가공), `maintain`(유지보수)
- **preset**: Admin Job 화면 상단의 영역별 일괄 실행 (`/admin/api/job-presets/:id/run`)
- **카탈로그**: `server/src/jobs/catalog.mjs` (그룹·라벨 단일 기준)
- **Lock**: `polling_job_locks`로 worker/API 간 중복 실행을 막는다. 재배포·프로세스 중단으로 lock/run이 남으면 worker가 60초마다 만료 lock과 orphaned `running` run을 정리한다. Admin Job 카드에서 lock 만료 시각과 해제 가능 여부를 확인할 수 있다.

주요 Job (V19 이후, reconcile 쌍은 `sync`로 통합):

- 뉴스 수집·보정 (`market_news_*`, RSS, SEC, DART). 주요 이슈는 `news_digest_items` + `/v1/news-digests` API(ingest)로 유지
- 투자 캘린더 (`calendar_economic`, `calendar_earnings`, `calendar_holidays` — Finnhub US 휴장)
- YouTube (`youtube_economy_latest` sync, `youtube_economy_popular`)
- 시세·일봉·코인

## 배포

Railway 빌드:

```bash
npm run railway:build
npm run railway:start
```

`railway.json`은 저장소 루트를 기준으로 `npm run railway:build`를 실행한다. 이 빌드는 Expo web bundle을 `server/src/public/web`에 생성한 뒤 server dependency를 설치한다.

- Node.js는 루트와 server `package.json`의 `engines.node` 기준을 따른다.
- Web client는 `/web` 하위가 canonical 경로다. 예: `/web/news`, `/web/signal`, `/web/quotes`
- 기존 root 앱 경로(`/news`, `/signal` 등)는 호환용으로 `/web/*`에 redirect한다.
- Web asset은 `/web/_expo/*`, `/web/assets/*`, `/web/favicon.ico`로 제공한다.
- API/Admin 경로(`/v1/*`, `/admin`, `/docs`, `/health`)는 web static보다 먼저 처리한다.

서버 배포 전 운영 DB에 Flyway migration이 먼저 적용되어 있어야 한다.
