# ETF 브리핑 자동화 연동

앱 표시명은 **ETF 브리핑**. API·테이블 키는 `etf-insights` / `etf_insights`를 유지한다. 외부 에이전트가 Signal Server에 적재한 뒤 앱이 `GET /v1/etf-insights`로 읽는다. **권장 발행 주기: 주 1회**(주간 리뷰). `period`는 `weekly` 권장(기존 `daily`도 허용).

## 앱 노출

| 경로 | 동작 |
|---|---|
| **더보기** (메인) | 허브 타일 → 리스트 `/etf-insights` |
| **홈** (보조) | 선택일 기준 최신건이 **7일 이내**일 때만 카드. 빈 섹션·상시 고정 금지 |
| 카드 탭 | 바텀시트 (`EtfInsightSheet`) |
| 리스트 행 | 상세 `/etf-insight` |
| 푸시·알림함 | ingest 시 발행 |

본문 UI: 시황 브리핑과 **보완** — lead · 히트맵 · 테마 · 수급 · 출처. **서버에 없는 섹션·필드는 앱에서 숨긴다**(빈 배열·빈 문자열·빈 rotation 표시 금지). 역할 표는 [DESIGN-GUIDE.md](./DESIGN-GUIDE.md).

Admin 데이터 초기화에 **ETF 브리핑**(`etfInsights`) 대상이 있다. 기존 적재분 정리: Flyway `V21__purge_etf_insights.sql` + 서버 `ensureSeeded` 1회 마커(`purge_etf_insights_v21`)로 `etf_insights`·관련 알림을 비운다.

홈 조회: `insightDate` 정확 일치 → 없으면 `insightDate ≤ 선택일` 최신 1건 → 그다음 7일 freshness 게이트. UTC는 [DATE-TIME.md](./DATE-TIME.md).

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
  "period": "weekly",
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
  "flowHighlights": [
    {
      "etf": "QQQ",
      "action": "inflow",
      "signal": "나스닥 하락 중에도 대형 성장주 저가 매수 유입",
      "amountLabel": "$2.4B",
      "url": "https://example.com/etf-flow",
      "sourceName": "Example Wire"
    }
  ],
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
  "pushTitle": "ETF 브리핑 도착",
  "pushBody": "반도체·AI ETF로 자금이 재집중됐습니다"
}
```

`id`와 `title`은 필수. `period` 기본값은 `daily`. `insightDate`가 없으면 `publishedAt`의 UTC 날짜를 쓴다.

앱 히트맵은 `changePercent`로 색을 칠한 3열 그리드로 그린다. 셀·수급 티커 탭 시 국내(`market: "kr"` 또는 `*.KS`/`*.KQ`/6자리)는 네이버 금융, 그 외는 Yahoo Finance로 연다.

**themes UI**: 테마명·모멘텀·요약만 표시(로고·하단 티커 목록 없음). `etfs`(및 히트맵 티커)가 요약 문장에 그대로 들어가면 앱이 본문에서 링크로 열어 준다. 한글 종목명만 있고 티커가 없으면 링크되지 않으므로, 클릭 유도가 필요하면 요약에 티커를 함께 쓴다.

### flowHighlights 권장 필드

| 필드 | 필수 | 설명 |
|---|---|---|
| `etf` / `symbol` | 권장 | 티커 — 로고·Yahoo/Naver 링크 |
| `action` | 권장 | `inflow` / `outflow` (또는 유입·유출) |
| `signal` | ✅ | 사용자가 읽어야 할 한 줄 시그널 |
| `amountLabel` | 권장 | `$2.4B` 등 금액 라벨 |
| `url` / `sourceUrl` | 선택 | 출처 기사 — 있으면 “출처 보기” |
| `sourceName` | 선택 | 출처명 |

## 저장

- 테이블: `etf_insights` (migration `V20__etf_insights.sql`)
- upsert 컬렉션 키: `etfInsights`
- 앱 캐시: `integrations/signal-api/cache/etfInsightsCache.ts` (TTL 2분)
