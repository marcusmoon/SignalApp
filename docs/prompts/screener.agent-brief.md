# 에이전트 브리프: 스크리너 (market 풀 + method)

Cursor/Codex/Claude 에이전트에 **그대로 붙여 넣을** 작업 지시서다.  
계약: [`docs/SCREENER-AUTOMATION.md`](../SCREENER-AUTOMATION.md)  
예제: [`docs/examples/screener.ingest.example.json`](../examples/screener.ingest.example.json)  
예약 dry-run: [`screener.codex-scheduled-prompt.md`](./screener.codex-scheduled-prompt.md)

---

## 한 줄 목표

지정 **market**의 공용 풀 스냅샷만 읽어 **method** 규칙으로 후보 JSON을 만들고, 사람 확인 후 `POST /v1/screener/runs/ingest`로 올린다.  
앱 `/screener?market=&method=`는 **published** ingest만 보여 준다.

기본 작업: `market=kr`, `method=fujimoto` (후지모토 모멘텀).

### 풀 메타 복사 (필수)

| 풀 | run |
|---|---|
| `data.id` | `run.poolSnapshotId` |
| `data.asOf` | `run.snapshotAsOf` |
| `data.policy.minTurnoverKrw` | 필터 임계값 |

`meta.asOfAgeHours > 24`이면 stale — dry-run으로 `items:[]` 또는 중단.  
수익률·`pctFrom52wHigh`는 비율(`0.08`=+8%). RSI는 14일(통과 조건 아님). null은 통과 불가(0으로 채우지 말 것).  
dry-run: `notifyInbox=false`+`sendPush=false` → `status=draft`(앱 비노출). 확인 후 published.

---

## 역할

| 한다 | 안 한다 |
|---|---|
| `GET` pool universe·snapshot (`?market=`) | 네이버·Yahoo·KRX·뉴스 등 외부 조회 |
| method 조건으로 필터·정렬 | PER/PBR/RSI/실적 **추정·검색으로 채우기** |
| `note` 작성 | 매수 권유·단정 문구 |
| (확인 후) runs ingest | dry-run 전에 ingest |
| | 해당 market 풀 밖 종목 추가 |

스크리너 서버 Job은 **`screener_pool_kr` 하나**다 (Yahoo 시세·**2y** 일봉 직접 조회 → `screener_snapshots`).  
앱 시세/일봉 Job과 순서 의존 없음. 에이전트는 **풀 GET + method 큐레이션 JSON**이 본업이다.

유니버스 `korea_screener_universe`(~80, venue). 풀에 `turnoverKrw`·RSI·모멘텀 슬롯이 채워진다 (비율).  
모멘텀은 250거래일+ 이력이 있어야 `ma200`/`return12m`/`alignedMa`가 정확하다 (`universe.barsGe253` 확인).  
**재무·외인/기관은 피드 없으면 null (통과 조건 아님).**

---

## 서버·인증

| 항목 | 값 |
|---|---|
| Base URL | `$SIGNAL_SERVER_URL` |
| Ingest 헤더 | `x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN` |
| Content-Type | `application/json` |

앱 경로(`/screener`)와 API(`/v1/screener…`)는 **다르다**.

---

## API

| Method | Path | 언제 |
|---|---|---|
| `GET` | `/v1/screener/pool/universe?market=kr` | 유니버스 |
| `GET` | `/v1/screener/pool/snapshot?market=kr` | 지표 스냅샷 |
| `GET` | `/v1/screener/methods?market=kr` | method 목록 |
| `GET` | `/v1/screener?market=kr&method=fujimoto` | (참고) 현재 큐레이션 |
| `POST` | `/v1/screener/runs/ingest` | **확인 후** 큐레이션 |
| `POST` | `/v1/screener/pool/snapshot/ingest` | 재무 풀을 채울 때만 (선택) |

---

## method=`fujimoto` (KR) — 모멘텀·추세 추종

철학: 가장 강한 추세 종목을 찾아 추세가 끝날 때까지 보유. 바닥 매매·저평가 단독 추천 금지.

핵심 지표가 **모두 있을 때만** 통과: `alignedMa`, `ma200`, `pctFrom52wHigh`, `volumeRatio`, `turnoverKrw`, `rsi`, `return3m`.

1. `alignedMa` = true (ma20 > ma60 > ma120)  
2. `currentPrice` > `ma200`  
3. `pctFrom52wHigh` ≥ -10  
4. `volumeRatio` ≥ 1  
5. `turnoverKrw` ≥ 스냅샷 `policy.minTurnoverKrw`  

RSI는 통과 조건이 아님(과열 감점은 스킬 스코어링).

**정렬:** 수익률 블렌드(3/6/12개월 50/30/20, null 축 재가중) 내림차순 → 신고가 근접 순  
**개수:** 최대 20 (Top10 권장). 없으면 `items: []`  
**title:** `후지모토 모멘텀`

---

## JSON (runs ingest)

### 최상위

| 필드 | 필수 | 설명 |
|---|---|---|
| `schemaVersion` | ✅ | `1` |
| `notifyInbox` / `sendPush` | 권장 | dry-run `false` |
| `run` | ✅ | 메타 (`market`, `method` 필수) |
| `items` | ✅ | 통과 종목 (최대 20) |

### `run`

| 필드 | 예시 |
|---|---|
| `id` | `screener:kr:fujimoto:<UTC generatedAt>` |
| `market` | `kr` |
| `method` | `fujimoto` |
| `title` | `후지모토 모멘텀` |
| `poolSnapshotId` | 읽은 풀 스냅샷 id |
| `snapshotAsOf` | 풀 `asOf` |

### `items[]`

| 필드 | 규칙 |
|---|---|
| `symbol` | KR: **6자리만**. global: 티커 |
| `market` | venue (`kospi`/`kosdaq` 등) — top-level `run.market`과 다름 |
| `note` | 한국어 1문장 ≤80자, 투자 권유 금지 |

---

## 절차

1. `GET …/pool/universe?market=kr` + `GET …/pool/snapshot?market=kr`  
2. 스냅샷이 비면 `items: []` dry-run만 출력  
3. method 필터·정렬·note  
4. JSON만 출력 (dry-run 플래그)  
5. 확인 후 ingest:

```bash
curl -X POST "$SIGNAL_SERVER_URL/v1/screener/runs/ingest" \
  -H "content-type: application/json" \
  -H "x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN" \
  --data @screener.json
```

---

## 붙여넣기용

```text
너는 SIGNAL 스크리너 편집자다. market=kr, method=fujimoto.

1) GET $SIGNAL_SERVER_URL/v1/screener/pool/universe?market=kr
2) GET $SIGNAL_SERVER_URL/v1/screener/pool/snapshot?market=kr
만 읽고, 후지모토 모멘텀(정배열·가격>ma200·신고가 부근·거래량 유지·거래대금≥minTurnoverKrw)으로
후보 JSON을 만든다. RSI는 통과 조건이 아니다.

규칙:
- 외부 조회·숫자 추정 금지. 스냅샷에 없는 값은 null, null 종목은 통과 불가.
- symbol은 6자리만. items 최대 20(Top10 권장). 정렬: return blend↓ 후 신고가 근접.
- run.market=kr, run.method=fujimoto, title=후지모토 모멘텀. note 한국어 1문장(≤80자), 매수 권유 금지.
- dry-run: notifyInbox=false, sendPush=false. ingest 금지.
- 최종 답변은 JSON만. 스키마는 docs/examples/screener.ingest.example.json.
```

숫자가 비어 통과 0개면 `items: []`로 보고하고, 숫자를 만들어 채우지 말 것.
