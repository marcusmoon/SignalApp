# 스크리너 자동화 연동

스크리너 Job·API·스킬 ingest용 큐레이션이다. **앱 전용 화면/메뉴는 없다** (알림 deepLink·API만).

- **market**: `kr` | `global` — 시장별 종목풀(풀)을 분리한다.
- **pool**: market당 공용 유니버스·지표 스냅샷. **모든 method가 동일 풀을 읽는다.**
- **method**: 큐레이션 방식(모델). 예: `momentum`. 이후 method를 추가해도 풀 API는 그대로다.

에이전트 브리프: [`docs/prompts/screener.agent-brief.md`](./prompts/screener.agent-brief.md)  
예약 dry-run: [`docs/prompts/screener.codex-scheduled-prompt.md`](./prompts/screener.codex-scheduled-prompt.md)  
예제: [`docs/examples/screener.ingest.example.json`](./examples/screener.ingest.example.json)

## 심플 구조 (Job 하나)

스크리너 데이터 경로는 **`screener_pool_kr` 하나**다. 앱 시세/일봉 Job과 **스케줄 순서를 맞출 필요 없다.**

```text
screener_pool_kr
  → universe 읽기 → Yahoo 시세·2y 일봉 직접 조회
  → RSI·turnover·모멘텀 계산 → screener_snapshots 저장

스킬 → GET pool/snapshot → method 필터 → POST runs/ingest → screener_runs
API → GET /v1/screener?market=&method=  (published만; 앱 화면 없음)
```

일봉 깊이: `return12m`은 종가 **253개**, `ma200`/`alignedMa`는 **200개**가 필요하다.  
Yahoo `1y`(~245–252세션)는 경계라 지표가 null로 떨어져 후보가 거의 안 나온다.  
풀 Job은 `params.dailyBarRange: "2y"`(기본)로 ~500세션을 받아 **DB 별도 백필 없이** 매 실행마다 이력을 확보한다.  
스냅샷 `universe.barCountMin` / `barsGe253`으로 깊이를 확인한다.

| 담당 | 역할 | 테이블 |
|---|---|---|
| **`screener_pool_kr`** | 유니버스·Yahoo 조회·지표·풀 스냅샷 (스크리너 전용 Job) | `screener_snapshots` |
| 스킬/에이전트 | pool GET → method 큐레이션 → runs ingest | `screener_runs` |
| 앱 시세/일봉 Job | **앱** 시세·차트만 (`korea_watchlist` 등). 스크리너와 무관 | `market_quotes`, `price_series` |

모델이 PER·PBR·RSI·실적을 **추정·검색으로 채우면 안 된다.**  
(풀 Job이 이미 넣은 숫자만 사용. 재무·외인/기관 피드가 없으면 null.)

## 시장·유니버스

| market | 유니버스(목표) | Job |
|---|---|---|
| `kr` | 코스피 시총 상위 30 + 코스닥 시총 상위 50 | `screener_pool_kr` |
| `global` | (후속) 글로벌 대형주 풀 | ingest 또는 후속 Job |

KR: 보통주만. Job이 우선주·스팩·관리/정리매매·거래정지 휴리스틱으로 제외한다. method는 해당 market 풀 밖 종목을 쓰지 않는다.

## 시간 기준·신선도

- `generatedAt`, `asOf`, `snapshotAsOf`, `publishedAt`: UTC ISO 8601
- `generatedDate`: UTC `YYYY-MM-DD`
- [DATE-TIME.md](./DATE-TIME.md)
- 스킬 스크리닝: **평일 08:00 KST** 권장. `screener_pool_kr`는 그 전(예: 07시대)에 전일 마감 기준으로 갱신 완료되도록 운영한다 (`params.preferredBeforeKst: "08:00"`).
- GET pool 응답 `meta.asOfAgeHours` — **24 초과면 stale** (`meta.staleAfterHours: 24`). `asOf`는 job 실행 시각(UTC)이며 누락되면 안 된다.

## 스킬 소비자 계약 (필수)

### 1) 스냅샷 루트 메타 (복사 대상)

스킬이 run 메타로 **그대로 복사**한다. 셋 모두 항상 존재해야 한다.

| 풀 필드 | run 필드 |
|---|---|
| `data.id` | `run.poolSnapshotId` |
| `data.asOf` | `run.snapshotAsOf` |
| `data.policy.minTurnoverKrw` | 필터 임계값 |

추가로 `policy.yoyUnit` (`ratio`), `policy.rsiPeriod` (`14`), `policy.nullMeansFail` (`true`).

### 2) null 정책

- 계산 실패·미수집 = **`null` 유지**. `0`으로 채우지 않는다.
- YoY `0`은 “실적 제자리”로 해석된다. 가짜 0은 필터를 왜곡한다.
- `null` 종목은 method 통과 불가.

### 3) YoY 단위 · RSI 기간

- YoY는 **비율**: `0.08` = **+8%** (퍼센트 포인트/이미 %로 적힌 값 아님). example JSON에 실제 `0.08` 등으로 표기.
- RSI는 **Wilder 14일** (`policy.rsiPeriod: 14`).

### 4) symbol 이중 규격

| 필드 | 형식 |
|---|---|
| `symbol` | KR **6자리** (`005930`) — ingest·앱 키 |
| `yahooSymbol` | 야후 조인 키 (`005930.KS` / `.KQ`) |
| `market` (행) | venue `kospi` \| `kosdaq` (top-level `kr`와 다름) |

풀 Job이 venue로 Yahoo 심볼을 잡고, 응답·일봉 키는 `.KS`/`.KQ`를 strip해 6자리 `symbol`로 맞춘다. venue가 틀리면 시세·일봉이 비거나 잘못 붙는다.

### 5) dry-run / status

| 조건 | `run.status` | `GET /v1/screener` | 알림 |
|---|---|---|---|
| `notifyInbox=false` **그리고** `sendPush=false` | `draft` (기본) | **노출 안 됨** | 안 함 |
| 그 외 또는 `status=published` | `published` | 노출 | 플래그 따름 |

- `notifyInbox`/`sendPush`만 false이고 `status=published`면 **앱 리스트에는 보이고** 푸시/인박스만 억제된다.
- “사람 확인 전 노출 금지” → dry-run은 둘 다 false (또는 `status: "draft"` 명시).

### 6) ingest 멱등성

같은 `(market, method, poolSnapshotId)` 재시도 시 **동일 row upsert** (결정적 id `screener:{market}:{method}:pool:{poolSnapshotId}`). unique index로 중복 방지.

### 7) 에러 응답

성공: `{ "data": ... }`  
실패: `{ "data": null, "error": { "code": "NOT_FOUND" } }` (스킬 파싱용).

## Endpoints

| Method | Path | 용도 |
|---|---|---|
| `GET` | `/v1/screener/pool/universe?market=` | 공용 유니버스 |
| `GET` | `/v1/screener/pool/snapshot?market=` | 공용 지표 스냅샷 |
| `POST` | `/v1/screener/pool/snapshot/ingest` | 풀 스냅샷 ingest |
| `GET` | `/v1/screener/methods?market=` | method 카탈로그 |
| `GET` | `/v1/screener/runs?market=&method=` | 목록 (기본 `status=published`) |
| `GET` | `/v1/screener/runs/:id` | 단건 (draft 포함) |
| `POST` | `/v1/screener/runs/ingest` | method 큐레이션 ingest |
| `GET` | `/v1/screener?market=&method=` | 최신 **published** (API/알림용) |

### Runs ingest

- Header: `x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN`

| 필드 | 역할 |
|---|---|
| `run.market` / `run.method` | 필수 |
| `run.poolSnapshotId` / `run.snapshotAsOf` | 풀 메타 복사 (필수 권장) |
| `run.status` | `draft` \| `published` (생략 시 플래그로 추론) |
| `notifyInbox` / `sendPush` | 알림·푸시 |

## method: `momentum` (KR) — 모멘텀·추세 추종

철학: **가장 강한 추세의 종목을 찾아 추세가 끝날 때까지 보유.** 바닥 매매·저평가 단독 추천 금지 (PER/PBR은 참고 필드일 뿐 통과 조건이 아니다).

핵심 지표(`alignedMa`, `ma200`, `pctFrom52wHigh`, `volumeRatio`, `turnoverKrw`, `rsi`, `return3m`)가 **모두 non-null**일 때만 통과.

1. `alignedMa` = true (ma20 > ma60 > ma120 정배열)  
2. `currentPrice` > `ma200` (장기 추세 위)  
3. `pctFrom52wHigh` ≥ -10 (52주 신고가 부근)  
4. `volumeRatio` ≥ 1 (거래량 유지·증가)  
5. 일 거래대금 ≥ `policy.minTurnoverKrw` (기본 100억)  

RSI는 통과 조건이 아니다 (모멘텀 주도주는 과열이 정상 — 과열 감점은 스킬 스코어링에서 처리).

정렬: 수익률 블렌드(3/6/12개월, 50/30/20 — null 축 재가중) 내림차순 → 신고가 근접 순. `items` 최대 20 (스킬은 Top10 권장).  
타이틀: `모멘텀`.

## 풀 지표 슬롯

| 슬롯 | 채움 | 비고 |
|---|---|---|
| `turnoverKrw`, `rsi` | Job (Yahoo 시세·일봉) | RSI는 method 통과 조건 아님 |
| `return3m/6m/12m`, `ma20/60/120/200`, `alignedMa`, `pctFrom52wHigh`, `volumeRatio` | Job (**2y** 일봉) | `momentum` 통과·정렬에 사용. 250거래일+ 필요 |
| `per`, `pbr`, YoY, `dividend*` | 피드 없으면 null | 참고 필드 (통과 조건 아님) |
| `foreignNetBuy`, `institutionNetBuy` | 피드 없으면 null | Money Flow 후속 |

## 구현 상태

| 레이어 | 상태 |
|---|---|
| Flyway | `V2`–`V5` (테이블·universe+venue·**one-job 디커플**) |
| 스크리너 Job | **`screener_pool_kr`만** (Yahoo self-fetch **2y** 일봉 + 지표 + `screener_snapshots`) |
| 앱 Job | `market_quotes_korea` / `market_price_series_daily` — watchlist·차트용, 스크리너 비의존 |
| 유니버스 | `korea_screener_universe` (~80, `venues`). 정식 KRX 시총 피드 후속 |
| 모멘텀 | 풀 Job이 일봉으로 계산 (`return*`/`ma*`/`alignedMa`/`pctFrom52wHigh`/`volumeRatio`) |
| 재무·외인/기관 | 피드 없음 → null |

## 앱 UI

앱 메뉴·`/screener` 화면은 **제거됨**. published ingest는 알림(`deepLink: /screener?…`)·API 조회용으로만 남는다.

## 권장 주기

| 레이어 | 주기 |
|---|---|
| `screener_pool_kr` | hourly (스킬 전 07시대 KST 권장) |
| method dry-run·ingest | 장전 ~08:00 KST 1회 |

앱 시세/일봉 Job 주기와 **맞출 필요 없음**.

## 운영 원칙

- dry-run은 `draft`로 올려 앱 노출을 막고, 확인 후 `published`로 재ingest  
- 풀에 없는 수치·종목 금지  
- market당 풀 공유 (method별 유니버스 복제 금지)  
- 스크리너 Job은 하나 (`screener_pool_kr`). quotes/일봉 Job에 의존하지 않음
