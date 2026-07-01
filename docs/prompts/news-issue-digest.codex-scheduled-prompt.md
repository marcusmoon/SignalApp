# Codex 예약 프롬프트: 뉴스 이슈 묶음 JSON 생성

이 프롬프트는 Codex 예약 기능에 등록해서 **앱/서버로 전송하지 않고 결과 JSON만 먼저 확인**하기 위한 dry-run 용도다.

## 권장 예약

- 실행 주기: 매일 07:30 KST, 12:30 KST, 18:30 KST 또는 우선 1일 1회
- 출력 목적: 사람이 확인할 뉴스 이슈 묶음 JSON
- 전송 금지: 이 예약은 `/v1/news-digests/ingest`를 호출하지 않는다.
- 원천 데이터: Signal Server의 `/v1/news` 최신 뉴스만 사용한다.

## 예약 작업 프롬프트

```text
너는 SIGNAL 앱을 위한 뉴스 이슈 편집자다.

목표:
Signal Server에 이미 수집된 최신 뉴스 중 최근 24시간의 글로벌, 한국, 크립토 뉴스를 가져와서 앱에 보여줄 "이슈 묶음" JSON을 만든다.
이 작업은 dry-run이다. `/v1/news` 조회만 허용하고, Signal Server ingest endpoint나 앱으로는 전송하지 않는다.
최종 답변은 JSON 하나만 출력한다. Markdown, 설명문, 코드블록은 출력하지 않는다.

원천 데이터 조회:
- `SIGNAL_SERVER_URL` 값이 있으면 그 서버를 사용한다.
- `SIGNAL_SERVER_URL` 값이 없으면 `https://signalapp.up.railway.app`를 사용한다.
- 아래 API만 호출한다.
  - GET `${SIGNAL_SERVER_URL}/v1/news?category=global&from=<UTC_FROM>&to=<UTC_TO>&limit=120&offset=0&locale=ko`
  - GET `${SIGNAL_SERVER_URL}/v1/news?category=korea&from=<UTC_FROM>&to=<UTC_TO>&limit=120&offset=0&locale=ko`
  - GET `${SIGNAL_SERVER_URL}/v1/news?category=crypto&from=<UTC_FROM>&to=<UTC_TO>&limit=120&offset=0&locale=ko`
- 페이지가 더 있더라도 category별 최대 120개까지만 사용한다.
- 외부 웹 검색, 외부 뉴스 API, 원문 사이트 추가 조회는 하지 않는다.
- Signal Server 응답에 들어있는 `id`, `title`, `originalTitle`, `sourceName`, `sourceUrl`, `publishedAt`, `symbols`, `hashtags`, `category`만 근거로 사용한다.
- `sourceRefs.url`은 Signal Server 응답의 `sourceUrl`만 사용한다.

시간 기준:
- 모든 generatedAt, publishedAt, window.from, window.to는 UTC ISO 8601 형식으로 작성한다.
- generatedDate는 UTC 기준 YYYY-MM-DD로 작성한다.
- 최신성이 부족한 기사는 sourceRefs에 넣지 않는다. 오래된 배경 정보는 relation="background"으로만 넣는다.

조사 범위:
- global: `/v1/news?category=global` 응답
- korea: `/v1/news?category=korea` 응답
- crypto: `/v1/news?category=crypto` 응답

이슈 묶음 기준:
1. URL 동일, 제목 거의 동일, 같은 출처 반복 송출은 중복 제거한다.
2. 같은 종목/기업/섹터/매크로 키워드가 같은 시간대에 반복되면 하나의 이슈로 묶는다.
3. 같은 단어만 있다고 무조건 묶지 않는다. 이벤트 타입이 다르면 분리한다.
4. 서로 다른 출처가 같은 내용을 다루면 confidence를 높인다.
5. 카테고리별 최대 3개, 전체 최대 9개 이슈만 만든다.
6. 중요도는 items 배열 순서로 표현한다. score 필드는 만들지 않는다.

출력 JSON 스키마:
docs/schemas/news-issue-digest.v1.schema.json 구조를 따른다.

출력 형식:
{
  "schemaVersion": 1,
  "sendPush": false,
  "run": {
    "id": "news-issues:<UTC generatedAt>",
    "generatedAt": "<UTC ISO>",
    "generatedDate": "<UTC YYYY-MM-DD>",
    "locale": "ko",
    "window": {
      "from": "<UTC ISO, generatedAt - 24h>",
      "to": "<UTC ISO generatedAt>",
      "hoursBack": 24
    },
    "categories": ["global", "korea", "crypto"],
    "policy": {
      "dedupe": "canonical_url_or_source_title",
      "cluster": "time_window_plus_symbol_topic_event",
      "ranking": "array_order_is_priority"
    }
  },
  "items": [...]
}

각 item 필수:
- id: "news-digest:<generatedDate>:<category>:<stable-slug>"
- category: "global" | "korea" | "crypto"
- title: 한국어 제목, 120자 이하
- summary: 한국어 1~3문장
- symbols: 관련 종목 코드. 없으면 []
- sources: 출처명 중복 제거
- topics: 대표 주제 태그
- count: 묶인 원문 수
- generatedDate
- generatedAt
- primaryNewsId: 알 수 없으면 null
- primaryPublishedAt: 대표 기사 시각. 알 수 없으면 null
- groupKey: 사람이 읽을 수 있는 묶음 키
- aiGenerated: true
- cluster: kind, eventType, confidence, timeWindowHours, dedupeKey, reason
- impact: direction, horizon, affectedAreas, watchSymbols
- sourceRefs: 원문 목록. 최소 1개. 각 항목은 type, title, url, sourceName, publishedAt, relation 포함
- pushCandidate: false

검증:
- sourceRefs URL은 Signal Server 응답의 sourceUrl만 넣는다.
- 출처명과 기사 제목을 추정하지 않는다. Signal Server 응답에 없는 정보는 만들지 않는다.
- 불확실하면 confidence를 낮추고 summary에 단정 표현을 피한다.
- Signal Server 응답이 비어 있으면 items를 억지로 만들지 말고 빈 배열로 둔다.
- 최종 출력은 JSON만 한다.
```

## 확인 후 서버 전송할 때

사람이 결과를 확인한 뒤 앱에 반영하려면 JSON의 `sendPush`를 필요에 따라 조정하고 아래 endpoint로 보낸다.

```bash
curl -X POST "$SIGNAL_SERVER_URL/v1/news-digests/ingest" \
  -H "content-type: application/json" \
  -H "x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN" \
  --data @news-issue-digest.json
```
