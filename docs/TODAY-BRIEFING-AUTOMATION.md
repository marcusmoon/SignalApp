# 오늘의 브리핑 자동화 연동

오늘의 브리핑은 홈 최상단에 노출하는 종합 요약이다. 뉴스 주요 이슈, 시장 브리핑, 시세를 원천으로 만들되 `market_briefings` 회차 데이터와 분리해 `today_briefings`에 저장한다.

## 시간 기준

- `briefingDate`: UTC 기준 `YYYY-MM-DD`
- `publishedAt`, `generatedAt`: UTC ISO 8601
- 서버 저장과 API 필터는 [DATE-TIME.md](./DATE-TIME.md)의 UTC 규칙을 따른다.

## Ingest Endpoint

- Method: `POST`
- URL: `/v1/today-briefings/ingest`
- Header: `x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN`

## 조회 Endpoint

```text
GET /v1/today-briefing?date=<UTC_YYYY-MM-DD>&locale=ko
GET /v1/today-briefings?from=<UTC_FROM>&to=<UTC_TO>&locale=ko&limit=10&offset=0
```

## 최소 Payload

```json
{
  "id": "today-briefing:2026-07-03:ko",
  "locale": "ko",
  "title": "오늘의 브리핑",
  "headline": "반도체 대형주 급반등이 코스피 8000선 회복을 이끌었습니다.",
  "summary": "코스피는 삼성전자와 SK하이닉스 강세를 중심으로 급반등했습니다. 글로벌 이슈는 메타의 AI칩 위탁 검토와 유로존 PMI 회복, 크립토는 비트코인 ETF 순유입 재개가 핵심입니다.",
  "keyPoints": [
    "코스피는 반도체 대형주 강세로 8000선을 회복했습니다.",
    "메타의 삼성 AI칩 위탁 검토가 반도체 심리를 보강했습니다.",
    "비트코인 현물 ETF 순유입이 재개됐습니다."
  ],
  "sections": [],
  "marketSnapshot": {},
  "sourceRefs": [
    {
      "kind": "digest",
      "title": "코스피 8000 붕괴 하루 만에 6% 급반등",
      "url": "https://example.com/story",
      "sourceName": "Example News",
      "publishedAt": "2026-07-03T08:51:38Z"
    }
  ],
  "relatedDigestIds": [],
  "relatedMarketBriefingIds": [],
  "briefingDate": "2026-07-03",
  "generatedAt": "2026-07-03T14:00:00Z",
  "publishedAt": "2026-07-03T14:00:00Z",
  "status": "published",
  "pushCandidate": false
}
```

## 예약 작업 원칙

- 매일 23:00 KST 실행을 기본으로 한다.
- dry-run 확인 전에는 `/v1/today-briefings/ingest`를 호출하지 않는다.
- Signal Server GET API 응답에 없는 출처, URL, 수치, 제목은 만들지 않는다.
- 확인 후 ingest할 때도 `sendPush`는 사용하지 않는다. 오늘의 브리핑은 홈 노출용이며 푸시는 별도 정책으로 다룬다.
