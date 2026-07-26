# 에이전트 브리프: 스크리너 (market 풀 + method)

Cursor/Codex/Claude 에이전트에 **그대로 붙여 넣을** 작업 지시서다.  
계약: [`docs/SCREENER-AUTOMATION.md`](../SCREENER-AUTOMATION.md)  
예제: [`docs/examples/screener.ingest.example.json`](../examples/screener.ingest.example.json)  
예약 dry-run: [`screener.codex-scheduled-prompt.md`](./screener.codex-scheduled-prompt.md)

---

## 한 줄 목표

지정 **market**의 공용 풀 스냅샷만 읽어 **method** 규칙으로 후보 JSON을 만들고, 사람 확인 후 `POST /v1/screener/runs/ingest`로 올린다.  
앱 `/screener?market=&method=`는 ingest 결과만 보여 준다.

기본 작업: `market=kr`, `method=fujimoto` (성장·저평가 눌림).

---

## 역할

| 한다 | 안 한다 |
|---|---|
| `GET` pool universe·snapshot (`?market=`) | 네이버·Yahoo·KRX·뉴스 등 외부 조회 |
| method 조건으로 필터·정렬 | PER/PBR/RSI/실적 **추정·검색으로 채우기** |
| `note` 작성 | 매수 권유·단정 문구 |
| (확인 후) runs ingest | dry-run 전에 ingest |
| | 해당 market 풀 밖 종목 추가 |

서버 Job `screener_pool_kr`가 KR 풀을 채운다. 에이전트는 **읽기 + method 큐레이션 JSON**이 본업이다.  
같은 market의 다른 method도 **동일 풀**을 읽는다.

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

## method=`fujimoto` (KR)

값이 **모두 있을 때만** 통과.

1. 매출 YoY > 0 **그리고** 영업이익 YoY > 0 **그리고** 순이익 YoY > 0  
2. PER > 0 **그리고** PER ≤ 15  
3. PBR > 0 **그리고** PBR ≤ 1  
4. `dividend === true` **또는** `dividendGrowthCapacity === true`  
5. `turnoverKrw` ≥ 스냅샷 `policy.minTurnoverKrw`  
6. RSI ≤ 30  

**정렬:** RSI 오름차순 → `changePercent` 오름차순  
**개수:** 최대 20. 없으면 `items: []`

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
| `title` | `성장·저평가 눌림` |
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
만 읽고, 후지모토식(증수·증익·PER≤15·PBR≤1·배당/증배·거래대금≥minTurnoverKrw·RSI≤30)으로
성장·저평가 눌림 후보 JSON을 만든다.

규칙:
- 외부 조회·숫자 추정 금지. 스냅샷에 없는 값은 null, null 종목은 통과 불가.
- symbol은 6자리만. items 최대 20. 정렬: RSI↑ 후 changePercent↑.
- run.market=kr, run.method=fujimoto. note 한국어 1문장(≤80자), 매수 권유 금지.
- dry-run: notifyInbox=false, sendPush=false. ingest 금지.
- 최종 답변은 JSON만. 스키마는 docs/examples/screener.ingest.example.json.
```

숫자가 비어 통과 0개면 `items: []`로 보고하고, 숫자를 만들어 채우지 말 것.
