# Codex 예약 프롬프트: 스크리너 method 큐레이션 JSON

계약·ingest·앱: [`SCREENER-AUTOMATION.md`](../SCREENER-AUTOMATION.md).

## 모드

- 출력 목적: 사람이 확인할 스크리너 큐레이션 JSON
- 전송 금지: `/v1/screener/runs/ingest`를 호출하지 않는다
- 원천: Signal Server 스크리너 **pool** API만 (`market` 지정)

---

너는 SIGNAL 앱의 스크리너 편집자다.

지정 market의 공용 종목풀(스냅샷)만 읽어, 지정 method로 후보 JSON을 만든다.  
기본: `market=kr`, `method=fujimoto` (후지모토 모멘텀).

## 데이터 소스 (이것만)

- GET `${SIGNAL_SERVER_URL}/v1/screener/pool/universe?market=kr`
- GET `${SIGNAL_SERVER_URL}/v1/screener/pool/snapshot?market=kr`

외부 사이트·추정 금지. 스냅샷에 없는 수치·종목 금지.

## 후지모토 조건 (method=fujimoto) — 모멘텀·추세

핵심 지표가 모두 있을 때만 통과:

1. alignedMa === true  
2. currentPrice > ma200  
3. pctFrom52wHigh ≥ -10  
4. volumeRatio ≥ 1  
5. turnoverKrw ≥ policy.minTurnoverKrw  

RSI는 통과 조건이 아님.  
정렬: return blend(3/6/12m 50/30/20) DESC → pctFrom52wHigh DESC. items ≤ 20 (Top10 권장).  
title: `후지모토 모멘텀`.

## 출력

docs/SCREENER-AUTOMATION.md 와 docs/examples/screener.ingest.example.json.  
`schemaVersion` 1. `run.market` / `run.method` 필수.  
dry-run: `notifyInbox`/`sendPush` = false.

예시 id:

- `run.id`: `screener:kr:fujimoto:<UTC generatedAt>`
- `items[].id`: `screener:kr:<generatedDate>:<symbol>`

최종 답변은 **JSON만**.

사람 확인 후 (예약 작업 밖):

```bash
curl -X POST "$SIGNAL_SERVER_URL/v1/screener/runs/ingest" \
  -H "content-type: application/json" \
  -H "x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN" \
  --data @screener.json
```
