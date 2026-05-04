# SIGNAL — 로컬 서버·스케줄러

Signal API 서버는 외부 API 데이터를 서버에서 수집·정규화·번역 저장한 뒤 앱과 어드민에 제공하기 위한 로컬 MVP입니다.

## 1. 실행 구성

현재 로컬 MVP에서는 아래 명령 하나로 **API + 어드민 + 스케줄러**가 같이 뜹니다.

```bash
npm run server:dev
```

열리는 주소:

| 항목 | 주소 |
|------|------|
| Health | `http://127.0.0.1:4000/health` |
| Admin | `http://127.0.0.1:4000/admin` |
| News API | `http://127.0.0.1:4000/v1/news?locale=ko&category=global` |
| Calendar API | `http://127.0.0.1:4000/v1/calendar` |
| YouTube API | `http://127.0.0.1:4000/v1/youtube` |
| Market Quotes API | `http://127.0.0.1:4000/v1/market-quotes?segment=popular` |
| Coins API | `http://127.0.0.1:4000/v1/coins` |
| Market Lists API | `http://127.0.0.1:4000/v1/market-lists/mega_cap` |
| Stock Profile API | `http://127.0.0.1:4000/v1/stock-profile?symbol=AAPL` |
| Stock Candles API | `http://127.0.0.1:4000/v1/stock-candles?symbol=AAPL&resolution=D` |
| Concalls API | `http://127.0.0.1:4000/v1/concalls?symbol=AAPL` |

어드민 로그인은 **`ADMIN_USERS` 환경 변수**에만 의존합니다. 한 줄 JSON 배열로 계정을 넣습니다.

```env
ADMIN_USERS=[{"id":"you","password":"secret"}]
```

Railway 등에서는 Variable 값에 그대로 넣거나, UI에서 따옴표 이스케이프 규칙에 맞게 입력합니다.

## 2. 서버 환경 변수

초기 설정:

```bash
cp server/.env.example server/.env
```

중요 변수:

| 변수 | 용도 |
|------|------|
| `PORT` / `HOST` | 로컬 서버 바인딩 (`127.0.0.1:4000`) |
| `ADMIN_USERS` | **필수(운영)**. 어드민 계정 JSON 배열 `[{"id","password"},…]`. 비우면 로그인 불가 |
| `FINNHUB_TOKEN` | 선택 seed/fallback. 가능하면 어드민 설정에서 입력 |
| `YOUTUBE_API_KEY` | 선택 seed/fallback. 가능하면 어드민 설정에서 입력 |
| `NINJAS_KEY` | 선택 seed/fallback. 컨콜 트랜스크립트 수집용 |
| `TRANSLATION_PROVIDER` | 선택 seed/fallback (`mock` / `openai` / `claude`) |
| `TRANSLATION_MODEL` | 선택 seed/fallback 번역 모델 이름 |

로컬 운영에서는 `.env`에 외부 API 키를 넣지 않아도 됩니다. **Admin > 설정 > 외부 API 키**에서 Finnhub/OpenAI/Claude/YouTube/Ninjas 키를 저장하면 다음 호출부터 바로 사용합니다. 화면에는 전체 키를 노출하지 않고 마스킹해서 표시합니다.

`.env` 값은 새 로컬 DB를 만들 때 초기값으로 seed하거나, 아직 어드민 설정이 없을 때 fallback으로 쓰기 위한 용도입니다.

번역 provider seed 예시:

```env
# 비용 없이 UI 흐름만 확인
TRANSLATION_PROVIDER=mock
TRANSLATION_MODEL=mock-ko-news-v1

# OpenAI 사용
OPENAI_API_KEY=...
TRANSLATION_PROVIDER=openai
TRANSLATION_MODEL=gpt-4o-mini

# Claude 사용
ANTHROPIC_API_KEY=...
TRANSLATION_PROVIDER=claude
TRANSLATION_MODEL=claude-3-5-haiku-latest
```

어드민의 **번역 설정** 메뉴에서도 locale별 provider/model/자동 번역 여부를 바꿀 수 있습니다. 번역 실패는 `news_translations`에 `failed` 상태로 남아 뉴스 관리에서 필터링할 수 있습니다.

앱 루트 `.env`에는 Signal 서버 주소의 **번들 기본값**만 둡니다. Finnhub/OpenAI/Claude/YouTube/CoinGecko/Ninjas 등 외부 provider 키는 서버/Admin에서 관리합니다.

## 3. 앱에서 로컬 서버 보기

앱 루트 `.env`:

```env
EXPO_PUBLIC_SIGNAL_API_BASE_URL=http://127.0.0.1:4000
```

이 값은 앱 설정의 **Signal 서버** 선택에서 `빌드(.env)` 모드일 때 쓰는 기본값입니다. 앱에서는 `bundle / dev / real / custom` 모드를 저장할 수 있고, 저장 위치는 `services/signalServerEndpoint.ts`의 AsyncStorage 키입니다.

Metro 재시작:

```bash
npx expo start -c
```

기기별 주의:

| 실행 환경 | API Base URL |
|-----------|--------------|
| iOS Simulator | `http://127.0.0.1:4000` |
| Android Emulator | `http://10.0.2.2:4000` |
| 실제 기기 | Mac의 LAN IP 예: `http://192.168.x.x:4000` |

## 4. 데이터 수집 흐름

어드민 `Polling Jobs`에서:

- `Run`: 해당 job을 즉시 1회 실행
- `Enabled` 체크 + `Save`: 서버가 켜져 있는 동안 주기 실행
- `Interval` 수정 + `Save`: 자동 실행 주기 변경
- `Job 실행 로그`: 수동/스케줄 실행 이력을 날짜·상태·타입·실행방식·키워드로 필터링

현재 기본 job:

| job | 내용 |
|-----|------|
| `market_news_global` | 글로벌 뉴스 최신 수집 |
| `market_news_crypto` | 코인 뉴스 최신 수집 |
| `market_news_global_reconcile` | 글로벌 뉴스 보정 수집 |
| `market_news_crypto_reconcile` | 코인 뉴스 보정 수집 |
| `market_news_financial_juice` | Financial Juice RSS 최신 수집 |
| `market_news_financial_juice_reconcile` | Financial Juice RSS 보정 수집 |
| `calendar_economic` | 경제 캘린더 최신 수집 |
| `calendar_earnings` | 실적 캘린더 최신 수집 |
| `youtube_economy_latest` | 경제 유튜브 최신 영상 수집 |
| `calendar_economic_reconcile` | 최근 과거~미래 경제지표 보정 수집 |
| `calendar_earnings_reconcile` | 실적 발표 전후 보정 수집 |
| `concall_transcripts_recent` | 최근 실적 캘린더 기반 컨콜 트랜스크립트 수집 |
| `youtube_economy_reconcile` | 저장된 유튜브 영상 상세/조회수 보정 수집 |
| `market_quotes_popular` | 인기 시세 최신 수집 |
| `market_quotes_watchlist` | 기본 관심종목 시세 수집 |
| `market_quotes_mcap` | 시총 상위 시세 수집 |
| `market_coins_top` | 코인 시총 상위 수집 |

스케줄러는 10초마다 due job을 확인합니다. `enabled: true`이고 `nextRunAt`이 비었거나 현재 시각 이전이면 실행합니다.

각 실행은 `server/data/jobs.json`의 `pollingJobRuns`에 남습니다. 로그에는 `jobKey`, `domain`, `provider`, `handler`, `trigger`, `status`, `startedAt`, `finishedAt`, `durationMs`, `resultKind`, `itemCount`, `errorMessage`가 포함됩니다. 수동 실행은 `trigger: manual`, 스케줄 실행은 `trigger: schedule`로 구분합니다.

어드민 대시보드의 `/admin/api/summary`는 영역별 저장 수와 함께 `dataAreas`를 내려줍니다. `dataAreas`에는 마지막 저장 데이터 시각, 마지막 실행/성공/실패, 활성 Job 수, 0건 완료 실행 수, 컨콜 트랜스크립트·뉴스 번역·채널/심볼 수 같은 품질 보조 지표가 포함됩니다.

Job에는 운영자가 보기 쉬운 `displayName`과 `description`이 있으며, 어드민 **수집 Job** 메뉴에서 수정할 수 있습니다. 내부 `jobKey`는 로그 추적용으로 유지됩니다.

메가캡·시총 후보·인기 시세·기본 관심종목 리스트는 **Admin > 설정 > 마켓 리스트 관리**에서 수정합니다. 앱은 `/v1/market-lists/:key`를 통해 같은 리스트를 조회할 수 있고, 시총 상위 시세 Job은 `mcap_universe`, 인기 시세 Job은 `popular_symbols`를 사용합니다.

앱은 시세 탭도 서버 DB 값을 사용합니다. 관심·인기·시총은 `/v1/market-quotes`, 코인은 `/v1/coins`를 조회합니다. 상세 화면의 프로필·캔들은 `/v1/stock-profile`, `/v1/stock-candles`를 조회합니다. 따라서 앱에 보이려면 해당 수집 Job이 먼저 실행되어 `server/data/market.json`에 값이 저장되어 있어야 합니다.

뉴스 번역은 `title/summary/content`와 함께 `hashtags`를 반환할 수 있습니다. 서버는 자동 태그를 `newsItems[].hashtags`에 저장하고, 어드민 뉴스 편집 모달에서 수동 태그로 고정하거나 자동 모드로 되돌릴 수 있습니다. `/v1/news`는 `tag` 쿼리로 해시태그 필터를 지원합니다.

## 5. 소스 분리

나중에 API 서버와 worker를 클라우드에서 분리하기 위해 소스는 이미 나뉘어 있습니다.

```text
server/src/jobs/runner.mjs      # job 1개 실행
server/src/jobs/scheduler.mjs   # due job 탐색 + runner 호출
server/src/server.mjs           # API + admin + local scheduler
server/src/http/               # HTTP 라우트(공용/관리자/공개 API) 도메인별 모듈
server/src/worker.mjs           # scheduler-only entrypoint
```

현재는 **`npm run server:dev`만 사용**합니다.

`npm run server:worker`는 future entrypoint입니다. 지금 API 서버와 동시에 켜면 job이 중복 실행될 수 있으므로 운영 lock이 들어가기 전까지는 같이 띄우지 않습니다.

## 6. 확인 명령

서버 확인:

```bash
curl http://127.0.0.1:4000/health
```

뉴스 확인:

```bash
curl 'http://127.0.0.1:4000/v1/news?locale=ko&category=global'
```

캘린더 확인:

```bash
curl 'http://127.0.0.1:4000/v1/calendar'
```

유튜브 확인:

```bash
curl 'http://127.0.0.1:4000/v1/youtube'
```

마켓 리스트 확인:

```bash
curl 'http://127.0.0.1:4000/v1/market-lists/mega_cap'
```

로컬 저장 파일은 용도별로 나뉩니다.

```text
server/data/settings.json   # appSettings, providerSettings, translationSettings, UI/model/news-source settings
server/data/jobs.json       # pollingJobs, pollingJobRuns
server/data/news.json       # newsItems, newsTranslations
server/data/calendar.json   # calendarEvents
server/data/concalls.json   # concallTranscripts
server/data/youtube.json    # youtubeVideos
server/data/market.json     # marketQuotes, coinMarkets, marketLists
```

- 과거 단일 `local-db.json`을 읽어 자동 분할하는 경로는 **제거**되었다. 배포 시에도 위 분할 파일만을 전제로 한다.
- 스토어 JSON이 깨져 `JSON.parse`가 실패하면 서버는 **표준 에러에 진단 로그**(경로, 길이, 메시지, 가능하면 position 주변·head/tail)를 남기고 예외를 올린다. 잘린 뒤쪽을 임의로 잘라 복구하지 않는다.
