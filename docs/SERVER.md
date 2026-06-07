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
| `DATA_DIR` | SQLite와 서버 런타임 데이터 위치 |
| `SIGNAL_DB_DRIVER` | 현재 런타임 DB driver. adapter 전환 전에는 `sqlite` |
| `HOST` | 서버 bind host |
| `PORT` | 서버 port |
| `ADMIN_USERS` | 초기 Admin 사용자 JSON |
| `SIGNAL_JWT_PRIVATE_KEY` | 앱 사용자 JWT private key PEM |
| `SIGNAL_JWT_PRIVATE_KEY_B64` | 앱 사용자 JWT private key base64 |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | LLM provider 키 |
| `YOUTUBE_API_KEY` | YouTube 수집 키 |
| `NINJAS_KEY` | 컨콜 등 Ninjas provider 키 |
| `DATABASE_URL` | Postgres 전환 준비용 연결 문자열 |

## API 그룹

| 그룹 | 경로 |
|---|---|
| 공개 | `/v1/news`, `/v1/youtube`, `/v1/market-quotes`, `/v1/calendar`, `/v1/insights` |
| 인증 | `/v1/auth/*`, `/v1/notifications`, `/v1/legal/terms` |
| Admin | `/admin/api/*` |

## Job 운영

Admin에서 Job을 등록하고 실행한다. Job 설정에는 provider, schedule, params, lock TTL이 포함된다. 실행 이력은 Admin에서 상태, 시작/종료 시각, 실패 사유, lock 상태를 확인한다.

주요 Job:

- 뉴스 RSS 수집
- YouTube 최신/인기 수집
- 투자 캘린더 수집
- 컨콜 수집
- 국내주식 야간 참고가 수집: `market_quotes_kr_after_hours`는 Hyperliquid trade[XYZ] HIP-3 시장(`dex=xyz`)의 파생상품 심볼을 매핑해 `kr_after_hours` 시세를 저장한다. 기본 후보는 `SMSN`, `SKHX`, `HYUNDAI`이며, `allMids` 응답의 `xyz:` 접두사를 제거해 매핑한다. 매핑이 실패해도 `yahooSymbol`(`005930.KS` 등)로 Yahoo 정규장 시세를 저장해 앱 야간 탭에서 종목이 누락되지 않게 한다. API 응답에는 `afterHoursAvailable`, `regularSession`, `official`, `notice`가 포함된다.
- 오늘의 시그널 생성
- 번역/보정

## SQLite 운영

- 운영 파일은 `DATA_DIR/signal.sqlite` 기준이다.
- WAL 모드를 사용한다.
- public API가 자주 조회하는 날짜, 타입, 심볼, 생성시각 컬럼에는 인덱스를 둔다.
- 중복 가능성이 큰 캘린더/뉴스는 저장 시 정규화 키를 유지하고 공개 API에서 최종 중복 제거를 적용한다.

## Postgres 전환 준비

운영 DB는 Postgres를 기본 목표로 둔다. 현재 서버 런타임은 SQLite adapter를 사용하므로 `DATABASE_URL`만 설정해도 런타임 저장소가 자동 전환되지는 않는다. 먼저 Flyway로 운영 스키마를 관리하고, 이후 저장소 adapter를 Postgres로 분리한다.

현재 준비된 범위:

- `pg` client dependency
- Postgres 연결 상태 점검용 client
- `npm --prefix server run db:postgres:check` 연결 확인 스크립트
- `/health`의 `db.postgres` 연결 점검 정보
- Flyway baseline schema

Flyway 기준 파일:

- 설정 예시: `server/db/flyway.conf.example`
- 마이그레이션: `server/db/migrations/postgres/V1__initial_signal_schema.sql`

Railway `DATABASE_URL`은 보통 `postgres://...` 형식이고 Flyway CLI는 JDBC URL이 필요하다.

```bash
flyway \
  -locations=filesystem:server/db/migrations/postgres \
  -url="jdbc:postgresql://HOST:PORT/DB?sslmode=require" \
  -user="USER" \
  -password="PASSWORD" \
  migrate
```

스키마 원칙:

- 앱/운영에서 자주 검색하는 값은 typed column으로 둔다.
- provider별 원본 응답과 유연한 필드는 `payload jsonb`에 보관한다.
- `news_items`, `youtube_videos`, `calendar_events`, `market_quotes`, `price_series`, `insight_items` 등 공개 API 조회 테이블은 날짜/카테고리/심볼 인덱스를 가진다.
- SQLite의 `signal.sqlite` 파일은 Postgres adapter 전환 전까지 운영 source of truth로 유지한다.

전환 순서:

1. Flyway로 운영 Postgres schema를 먼저 생성한다.
2. SQLite 데이터를 Postgres schema로 백필한다.
3. 서버 DB 접근을 `sqlite` / `postgres` repository adapter로 분기한다.
4. API와 worker를 같은 `SIGNAL_DB_DRIVER=postgres`와 같은 `DATABASE_URL`로 배포한다.
5. `/health`에서 `activeStore=postgres`와 Postgres 연결 상태를 확인한 뒤 SQLite volume 의존도를 제거한다.

## 배포

Railway 빌드:

```bash
npm run railway:build
npm run railway:start
```

운영에서는 `DATA_DIR=/mnt/data`처럼 persistent volume을 지정한다.
