# ETF 인사이트 자동화 연동

ETF 인사이트는 외부 에이전트가 Signal Server에 적재한 뒤, 앱 홈이 `GET /v1/etf-insights`로 읽어 노출한다.

## 홈 노출

- 위치: **시장 브리핑 아래 · 공시 플로우 위**
- 홈 카드: 날짜별 단일 카드 → **바텀시트** (`EtfInsightSheet` + `EtfInsightBlock`)
- 섹션 헤더 `>`: 리스트(`/etf-insights`) → 행 탭 시 전체 상세(`/etf-insight`)
- 본문: 시황 브리핑과 동일 — lead(summary·로테이션·핵심 포인트) · 히트맵 · 테마 · 수급 · 출처
- 홈 조회: 선택일 `insightDate` 정확 일치 → 없으면 `insightDate ≤ 선택일`인 최신 1건
- UTC 규칙은 [DATE-TIME.md](./DATE-TIME.md).

## Ingest Endpoint

- Method: `POST`
- URL: `/v1/etf-insights/ingest`
- Header: `x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN`

요청 본문 최상위(또는 `insight` 객체와 형제)에 알림 플래그를 둔다. 기본값은 둘 다 `true`이며 서로 독립이다.

| 필드 | 역할 |
|---|---|
| `notifyInbox` | 알림센터(`notification_items`) 적재 |
| `sendPush` | 기기 푸시 큐 (`payload.pushDelivery: pending`) |

## 조회 Endpoint

```text
GET /v1/etf-insights?date=<UTC_YYYY-MM-DD>&period=daily&limit=10&offset=0
GET /v1/etf-insights?from=<UTC_FROM>&to=<UTC_TO>&limit=10&offset=0
GET /v1/etf-insights/:id
```

Admin: `GET/PATCH/DELETE /admin/api/etf-insights`.

## 최소 Payload

```json
{
  "notifyInbox": true,
  "sendPush": true,
  "id": "etf-insight:2026-07-18:daily",
  "period": "daily",
  "title": "반도체·AI ETF로 자금이 재집중됐습니다",
  "summary": "국내·미국 ETF 모두 AI·반도체 테마 유입이 두드러졌고, 방어·배당 쪽은 상대적으로 둔화됐습니다.",
  "insightDate": "2026-07-18",
  "publishedAt": "2026-07-18T06:30:00Z",
  "insights": [
    "반도체·AI ETF 순유입이 확대됐습니다.",
    "배당·방어 테마는 상대적으로 유출 또는 정체입니다."
  ],
  "themes": [
    {
      "name": "반도체 급락 심화",
      "rank": 1,
      "momentum": "하락",
      "etfs": ["SMH", "091160.KS"],
      "summary": "미국·한국 반도체 ETF 동반 약세."
    }
  ],
  "flowHighlights": [],
  "heatmap": [
    { "etf": "XLE", "sector": "에너지", "trend": "▲", "changePercent": 1.16 },
    { "etf": "SMH", "sector": "반도체", "trend": "▽", "changePercent": -2.18 }
  ],
  "rotation": {
    "from": "반도체·성장주",
    "to": "에너지·안전자산",
    "confidence": "high"
  },
  "sourceRefs": [
    {
      "type": "news",
      "id": "codex-news:global:abc123",
      "title": "AI ETF inflows accelerate",
      "url": "https://example.com/etf-flow",
      "sourceName": "Example Wire",
      "publishedAt": "2026-07-18T05:00:00Z"
    }
  ],
  "pushTitle": "ETF 인사이트 도착",
  "pushBody": "반도체·AI ETF로 자금이 재집중됐습니다"
}
```

`id`와 `title`은 필수. `period` 기본값은 `daily`. `insightDate`가 없으면 `publishedAt`의 UTC 날짜를 쓴다.

앱 히트맵은 `changePercent`로 색을 칠한 3열 그리드로 그린다. 셀·테마 티커 탭 시 국내(`market: "kr"` 또는 `*.KS`/`*.KQ`/6자리)는 네이버 금융, 그 외는 Yahoo Finance로 연다.

## 저장

- 테이블: `etf_insights` (migration `V20__etf_insights.sql`)
- upsert 컬렉션 키: `etfInsights`
- 앱 캐시: `integrations/signal-api/cache/etfInsightsCache.ts` (TTL 2분)
