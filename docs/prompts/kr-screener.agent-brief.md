# 에이전트 브리프: 한국주 스크리너 (후지모토식)

Cursor/Codex/Claude 에이전트에 **그대로 붙여 넣을** 작업 지시서다.  
계약 상세: [`docs/KR-SCREENER-AUTOMATION.md`](../KR-SCREENER-AUTOMATION.md)  
예제 JSON: [`docs/examples/kr-screener.ingest.example.json`](../examples/kr-screener.ingest.example.json)  
예약 dry-run 전용 프롬프트: [`kr-screener.codex-scheduled-prompt.md`](./kr-screener.codex-scheduled-prompt.md)

---

## 한 줄 목표

Signal Server 스냅샷만 읽어 **성장·저평가 눌림** 후보 JSON을 만들고, 사람 확인 후 `POST /v1/kr-screener/ingest`로 올린다.  
앱 화면 `/screener`는 이 ingest 결과만 보여 준다.

---

## 역할 (에이전트가 하는 일 / 안 하는 일)

| 한다 | 안 한다 |
|---|---|
| `GET`으로 universe·snapshot 조회 | 네이버·Yahoo·KRX·뉴스 등 외부 조회 |
| 후지모토 조건으로 필터·정렬 | PER/PBR/RSI/실적 **추정·검색으로 채우기** |
| `note` 한국어 1문장 작성 | 매수 권유·단정 문구 |
| (확인 후) ingest POST | dry-run 전에 ingest |
| | 유니버스 밖 종목 추가 |

서버 Job `kr_screener_snapshot`이 스냅샷을 채운다. 에이전트는 **읽기 + 큐레이션 JSON**이 본업이다.

---

## 서버·인증

| 항목 | 값 |
|---|---|
| Base URL | `$SIGNAL_SERVER_URL` (없으면 `https://signalapp.up.railway.app`) |
| Ingest 헤더 | `x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN` |
| Content-Type | `application/json` |

앱 경로(`/screener`)와 API 경로(`/v1/kr-screener`)는 **다르다**.

---

## API (에이전트용)

| Method | Path | 언제 |
|---|---|---|
| `GET` | `/v1/kr-screener/universe` | 유니버스 심볼 목록 |
| `GET` | `/v1/kr-screener/snapshot` | 지표 스냅샷 (필터 근거) |
| `GET` | `/v1/kr-screener?preset=fujimoto` | (참고) 현재 앱에 올라간 큐레이션 |
| `POST` | `/v1/kr-screener/ingest` | **확인 후** 큐레이션 업로드 |
| `POST` | `/v1/kr-screener/snapshot/ingest` | 재무 스냅샷을 에이전트가 채울 때만 (선택) |

---

## 후지모토 통과 조건 (`preset=fujimoto`)

값이 **모두 있을 때만** 통과. 하나라도 null/모름이면 탈락.

1. 매출 YoY > 0 **그리고** 영업이익 YoY > 0 **그리고** 순이익 YoY > 0  
2. PER > 0 **그리고** PER ≤ 15  
3. PBR > 0 **그리고** PBR ≤ 1  
4. `dividend === true` **또는** `dividendGrowthCapacity === true`  
5. `turnoverKrw` ≥ 스냅샷 `policy.minTurnoverKrw` (없으면 탈락, 스킵 금지)  
6. RSI ≤ 30  

**정렬:** RSI 오름차순 → `changePercent` 오름차순  
**개수:** 최대 20. 없으면 `items: []`

---

## 서버로 올릴 JSON (큐레이션 ingest)

### 최상위

| 필드 | 필수 | 설명 |
|---|---|---|
| `schemaVersion` | ✅ | `1` |
| `notifyInbox` | 권장 | dry-run `false` / 운영 기본 `true` |
| `sendPush` | 권장 | dry-run `false` / 필요할 때만 `true` |
| `run` | ✅ | 아래 메타 |
| `items` | ✅ | 통과 종목 배열 (최대 20) |

### `run`

| 필드 | 예시 / 규칙 |
|---|---|
| `id` | `kr-screener:<UTC generatedAt>` |
| `generatedAt` | UTC ISO 8601 |
| `generatedDate` | UTC `YYYY-MM-DD` |
| `locale` | `ko` |
| `preset` | `fujimoto` |
| `title` | `성장·저평가 눌림` |
| `universe.kospiTop` / `kosdaqTop` | `30` / `50` |
| `universe.asOf` | 스냅샷/유니버스 asOf |
| `snapshotAsOf` | 스냅샷 `asOf` 그대로 |
| `policy.ranking` | `rsi_asc_then_change_percent_asc` |
| `policy.maxItems` | `20` |
| `policy.requireAllMetrics` | `true` |

### `items[]` (각 종목)

| 필드 | 타입 | 규칙 |
|---|---|---|
| `id` | string | `kr-screener:<generatedDate>:<symbol>` |
| `symbol` | string | **6자리만** (`005930`). `.KS`/`.KQ` 금지 |
| `name` | string | 스냅샷 이름 |
| `market` | string | `kospi` \| `kosdaq` |
| `universeRank` | number\|null | 스냅샷 순위 |
| `passed` | boolean | 항상 `true` (통과분만) |
| `currentPrice` | number\|null | |
| `changePercent` | number\|null | 예: `-1.8` |
| `per` / `pbr` | number\|null | |
| `revenueYoY` / `operatingProfitYoY` / `netProfitYoY` | number\|null | 비율 (`0.08` = +8%) |
| `dividend` / `dividendGrowthCapacity` | boolean\|null | |
| `turnoverKrw` | number\|null | 원 단위 |
| `rsi` | number\|null | |
| `note` | string | 한국어 1문장, ≤80자, 투자 권유 금지 |
| `aiGenerated` | boolean | 보통 `true` |

---

## 작업 절차 (권장)

1. `GET …/universe` + `GET …/snapshot`  
2. 스냅샷이 비면 `items: []`인 dry-run JSON만 출력하고 종료 (가짜 종목 금지)  
3. 후지모토 필터·정렬·note 작성  
4. **JSON만** 출력 (dry-run: `notifyInbox`/`sendPush` = `false`)  
5. 사람 확인 후 플래그 조정 → ingest:

```bash
curl -X POST "$SIGNAL_SERVER_URL/v1/kr-screener/ingest" \
  -H "content-type: application/json" \
  -H "x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN" \
  --data @kr-screener.json
```

---

## 붙여넣기용 짧은 지시 (Chat/Agent)

아래 블록을 에이전트 첫 메시지로 쓰면 된다.

```text
너는 SIGNAL 한국주 스크리너 편집자다.

1) GET $SIGNAL_SERVER_URL/v1/kr-screener/universe
2) GET $SIGNAL_SERVER_URL/v1/kr-screener/snapshot
만 읽고, 후지모토식(증수·증익·PER≤15·PBR≤1·배당/증배·거래대금≥minTurnoverKrw·RSI≤30)으로
성장·저평가 눌림 후보 JSON을 만든다.

규칙:
- 외부 사이트 조회·숫자 추정 금지. 스냅샷에 없는 값은 null, null 종목은 통과 불가.
- symbol은 6자리만. items 최대 20. 정렬: RSI↑ 후 changePercent↑.
- note는 한국어 1문장(≤80자), 매수 권유 금지.
- 지금은 dry-run: notifyInbox=false, sendPush=false. ingest 호출 금지.
- 최종 답변은 JSON만 (마크다운/설명 금지).
- 스키마는 docs/examples/kr-screener.ingest.example.json 을 따른다.
```

---

## 스냅샷이 빈약한 경우

현재 Job은 시세·RSI 위주라 PER/PBR/YoY/배당이 비어 있으면 **통과 종목이 0개**일 수 있다.  
그때는:

- dry-run으로 `items: []`를 내고 원인을 짧게 보고하거나  
- (별도 권한이 있을 때만) 재무가 채워진 스냅샷을 `POST /v1/kr-screener/snapshot/ingest`로 올린 뒤 다시 필터한다.

숫자를 만들어 채워 ingest하지 말 것.
