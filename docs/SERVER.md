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
| `HOST` | 서버 bind host |
| `PORT` | 서버 port |
| `ADMIN_USERS` | 초기 Admin 사용자 JSON |
| `SIGNAL_JWT_PRIVATE_KEY` | 앱 사용자 JWT private key PEM |
| `SIGNAL_JWT_PRIVATE_KEY_B64` | 앱 사용자 JWT private key base64 |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | LLM provider 키 |
| `YOUTUBE_API_KEY` | YouTube 수집 키 |
| `NINJAS_API_KEY` | 컨콜 등 Ninjas provider 키 |

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
- 국내주식 야간 참고가 수집: `market_quotes_kr_after_hours`는 Hyperliquid trade[XYZ] HIP-3 시장(`dex=xyz`)의 파생상품 심볼을 매핑해 `kr_after_hours` 시세를 저장한다. 기본 후보는 `SAMSUNG`, `SKHX`/`SKHYNIX`, `HYUNDAI`이며, 매핑이 실패해도 `yahooSymbol`(`005930.KS` 등)로 Yahoo 정규장 시세를 저장해 앱 야간 탭에서 종목이 누락되지 않게 한다. API 응답에는 `afterHoursAvailable`, `regularSession`, `official`, `notice`가 포함된다.
- 오늘의 시그널 생성
- 번역/보정

## SQLite 운영

- 운영 파일은 `DATA_DIR/signal.sqlite` 기준이다.
- WAL 모드를 사용한다.
- public API가 자주 조회하는 날짜, 타입, 심볼, 생성시각 컬럼에는 인덱스를 둔다.
- 중복 가능성이 큰 캘린더/뉴스는 저장 시 정규화 키를 유지하고 공개 API에서 최종 중복 제거를 적용한다.

## 배포

Railway 빌드:

```bash
npm run railway:build
npm run railway:start
```

운영에서는 `DATA_DIR=/mnt/data`처럼 persistent volume을 지정한다.
