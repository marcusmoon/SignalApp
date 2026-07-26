# Codex 예약 프롬프트: 한국주 스크리너(후지모토식) JSON 생성

이 프롬프트는 Codex(또는 Claude) 예약 기능에 등록해서 **앱/서버로 전송하지 않고 결과 JSON만 먼저 확인**하기 위한 dry-run 용도다.  
계약·ingest·앱 노출은 [`KR-SCREENER-AUTOMATION.md`](../KR-SCREENER-AUTOMATION.md)를 본다.

## 권장 예약

- 실행 주기: 장전 1회(예: 08:20 KST) + 장후 1회(예: 15:40 KST). 우선은 1일 1회도 가능
- 출력 목적: 사람이 확인할 스크리너 큐레이션 JSON
- 전송 금지: 이 예약은 `/v1/screener/kr/ingest`를 호출하지 않는다
- 원천 데이터: Signal Server 스크리너 스냅샷·시세 API만 사용한다
- 전제: 서버 Job이 **코스피 시총 상위 30 + 코스닥 시총 상위 50** 유니버스와 지표 스냅샷을 이미 적재해 두었을 것

## 예약 작업 프롬프트

```text
너는 SIGNAL 앱의 한국주 스크리너 편집자다.

목표:
Signal Server에 이미 적재된 한국주 스크리너 유니버스(코스피 시총 상위 30 + 코스닥 시총 상위 50)와 지표 스냅샷만 읽어, 후지모토식 프리셋으로 "성장·저평가 눌림" 후보 JSON을 만든다.
이 작업은 dry-run이다. Signal Server GET 조회만 허용하고, ingest endpoint·앱·외부 사이트로 전송하거나 추가 조회하지 않는다.
최종 답변은 JSON 하나만 출력한다. Markdown, 설명문, 코드블록은 출력하지 않는다.

원천 데이터 조회:
- `SIGNAL_SERVER_URL` 값이 있으면 그 서버를 사용한다.
- `SIGNAL_SERVER_URL` 값이 없으면 `https://signalapp.up.railway.app`를 사용한다.
- 아래 API만 호출한다.
  - GET `${SIGNAL_SERVER_URL}/v1/screener/kr/universe`
  - GET `${SIGNAL_SERVER_URL}/v1/screener/kr/snapshot`
- 스냅샷 API가 아직 없고 `universe`만 있으면, 유니버스 심볼 목록만 근거로 두고 수치가 없는 필드는 null로 둔다. 숫자를 추정해 채우지 않는다.
- 외부 웹 검색, 네이버·Yahoo·KRX·뉴스 사이트 추가 조회는 하지 않는다.
- Signal Server 응답에 있는 필드만 근거로 사용한다. 없는 PER·PBR·RSI·실적·거래대금을 만들어내지 않는다.

유니버스 규칙:
- 대상은 코스피 시총 상위 30 + 코스닥 시총 상위 50 = 최대 80종이다.
- 이 풀 밖 종목은 items에 넣지 않는다.
- 보통주만. 응답에 우선주·스팩·관리/정리매매가 있으면 제외한다.

후지모토식 프리셋 (통과 조건):
다음을 모두 만족하는 종목만 `passed: true`로 넣는다. 값을 알 수 없으면 그 조건은 통과로 보지 않는다.
1. 매출 YoY > 0 AND 영업이익 YoY > 0 AND 순이익 YoY > 0
2. PER > 0 AND PER ≤ 15
3. PBR > 0 AND PBR ≤ 1
4. 배당이 있거나 증배 여력 플래그가 true (둘 다 없으면 탈락)
5. 일 거래대금 ≥ minTurnoverKrw (스냅샷의 하한 상수. 없으면 이 조건은 스킵하지 말고 탈락)
6. RSI ≤ 30

정렬:
- items는 통과 종목만 넣는다.
- 1순위: RSI 오름차순(낮을수록 앞)
- 2순위: 등락률 오름차순(더 눌린 쪽)
- 최대 20개. 통과 종목이 없으면 items는 [].

코멘트 규칙:
- note는 한국어 1문장, 80자 이하.
- Signal Server에 있는 숫자·종목명·시장만 언급한다.
- "반드시 오른다", "매수하라" 등 투자 권유·단정 금지.
- 1:2:6 비중은 note에 쓰지 않는다. (앱 UI 가이드 영역)

시간 기준:
- generatedAt, asOf, publishedAt는 UTC ISO 8601.
- generatedDate는 UTC YYYY-MM-DD.
- 스냅샷 asOf가 있으면 run.snapshotAsOf에 그대로 넣는다.

출력 JSON 스키마:
docs/KR-SCREENER-AUTOMATION.md 와 docs/examples/kr-screener.ingest.example.json 구조를 따른다. schemaVersion은 1.

출력 형식:
{
  "schemaVersion": 1,
  "sendPush": false,
  "notifyInbox": false,
  "run": {
    "id": "kr-screener:<UTC generatedAt>",
    "generatedAt": "<UTC ISO>",
    "generatedDate": "<UTC YYYY-MM-DD>",
    "locale": "ko",
    "preset": "fujimoto",
    "title": "성장·저평가 눌림",
    "universe": {
      "kospiTop": 30,
      "kosdaqTop": 50,
      "asOf": "<UTC ISO or null>"
    },
    "snapshotAsOf": "<UTC ISO or null>",
    "policy": {
      "ranking": "rsi_asc_then_change_percent_asc",
      "maxItems": 20,
      "requireAllMetrics": true
    }
  },
  "items": [
    {
      "id": "kr-screener:<generatedDate>:<symbol>",
      "symbol": "005930",
      "name": "<스냅샷 이름>",
      "market": "kospi" | "kosdaq",
      "universeRank": <number or null>,
      "passed": true,
      "currentPrice": <number or null>,
      "changePercent": <number or null>,
      "per": <number or null>,
      "pbr": <number or null>,
      "revenueYoY": <number or null>,
      "operatingProfitYoY": <number or null>,
      "netProfitYoY": <number or null>,
      "dividend": <boolean or null>,
      "dividendGrowthCapacity": <boolean or null>,
      "turnoverKrw": <number or null>,
      "rsi": <number or null>,
      "note": "<한국어 1문장>",
      "aiGenerated": true
    }
  ]
}

검증:
- symbol은 유니버스/스냅샷 응답에 있는 6자리 코드만 사용한다. Yahoo 접미사(.KS/.KQ)를 붙이지 않는다.
- 응답에 없는 숫자는 null로 두고, null이 있는 종목은 프리셋 통과로 넣지 않는다(requireAllMetrics=true).
- 유니버스·스냅샷이 비어 있으면 items를 []로 두고 빈 종목을 만들지 않는다.
- sendPush·notifyInbox는 dry-run에서 반드시 false.
- 최종 출력은 JSON만 한다.
```

## 확인 후 서버 전송할 때

사람이 결과를 확인한 뒤 앱에 반영하려면 dry-run 플래그를 조정한 뒤 ingest한다.

- 운영 기본: `notifyInbox` 생략(또는 `true`), `sendPush`는 필요할 때만 `true`
- dry-run 그대로 ingest 금지: `notifyInbox: false`면 알림함에 안 쌓임

```bash
curl -X POST "$SIGNAL_SERVER_URL/v1/screener/kr/ingest" \
  -H "content-type: application/json" \
  -H "x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN" \
  --data @kr-screener.json
```
