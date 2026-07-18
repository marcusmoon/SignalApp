# 오늘의 브리핑 자동화 연동

오늘의 브리핑(앱 표시명 **오늘 정리**)은 홈 히어로로 쓰는 종합 요약이다. API·테이블 키는 `today_briefings`를 유지한다. 뉴스 주요 이슈, 장중 브리핑, 시세를 원천으로 만들되 `market_briefings` 회차 데이터와 분리해 저장한다.

## 시간 기준

- `briefingDate`: UTC 기준 `YYYY-MM-DD`
- `publishedAt`, `generatedAt`: UTC ISO 8601
- 서버 저장과 API 필터는 [DATE-TIME.md](./DATE-TIME.md)의 UTC 규칙을 따른다.

## Ingest Endpoint

- Method: `POST`
- URL: `/v1/today-briefings/ingest`
- Header: `x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN`

요청 본문 최상위에 `notifyInbox`(알림센터 적재)와 `sendPush`(기기 푸시)를 둔다. 기본값 `true`, 서로 독립.

## 조회 Endpoint

```text
GET /v1/today-briefing?date=<UTC_YYYY-MM-DD>&locale=ko
GET /v1/today-briefings?from=<UTC_FROM>&to=<UTC_TO>&locale=ko&limit=10&offset=0
```

`sourceRefs`는 ingest 시 `type`+`id`만 저장하고 read 시 hydrate한다([`DIGEST-SOURCE-REF-HYDRATION.md`](./DIGEST-SOURCE-REF-HYDRATION.md)).

## 최소 Payload

```json
{
  "notifyInbox": true,
  "sendPush": true,
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
      "type": "news",
      "id": "codex-news:global:abc123",
      "relation": "primary"
    }
  ],
  "relatedDigestIds": [],
  "relatedMarketBriefingIds": [],
  "briefingDate": "2026-07-03",
  "generatedAt": "2026-07-03T14:00:00Z",
  "publishedAt": "2026-07-03T14:00:00Z",
  "status": "published",
  "pushTitle": "오늘 정리 도착",
  "pushBody": "오늘 시장을 한눈에 정리했습니다."
}
```

## 예약 작업 원칙

- 매일 23:00 KST 실행을 기본으로 한다.
- dry-run 확인 전에는 `/v1/today-briefings/ingest`를 호출하지 않는다.
- Signal Server GET API 응답에 없는 출처, URL, 수치, 제목은 만들지 않는다.
- 확인 후 ingest 시 `notifyInbox=true`(기본)이면 알림함에 적재된다. `sendPush=false`로 푸시만 건너뛸 수 있다. 두 플래그는 독립이다.
- 푸시 `deepLink`는 `/today-briefing?date=<briefingDate>`이다.

## 앱 UI

- 홈 히어로: KST 23:00 이후(및 과거일 우선)에 `today_briefings`를 「오늘 정리」로 노출. 그 전에는 장중 브리핑 회차가 히어로. 선택 로직은 `domain/home/selectHomeHeroBriefing.ts`.
- 홈·상세: `components/signal/HomeFocusContent.tsx`, `app/today-briefing.tsx` — Stack 제목 「오늘 정리」, 날짜는 헤더 아래 `dateBar`.
- 레이아웃·여백: [DESIGN-GUIDE.md](./DESIGN-GUIDE.md), [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md)
