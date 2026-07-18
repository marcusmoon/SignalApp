# 시장 브리핑 자동화 연동

국내/미국 시장 브리핑 자동화는 Signal Server에 먼저 적재한 뒤 앱이 `/v1/market-briefings`로 읽도록 연결한다.

## 권장 스케줄

- 국내 오전(`morning`): 매 영업일 오전 7:30 KST — 장 시작 전
- 국내 오후(`lunch`): 매 영업일 오후 12:10 KST — 점심
- 국내 마감(`close`): 매 영업일 장 종료 후 — 마감 브리핑
- 미국 밤사이(`overnight`): 매 영업일 오전 6:30 KST

## 국내 session 기준

실행 시각(한국 시간)에 따라 `session`을 정한다.

| session | 실행 시점 | 작성 초점 |
|---|---|---|
| `morning` | 장 시작 전 | 장 시작 전 관전 포인트 |
| `lunch` | 점심 | 오전장 흐름과 오후장 변수 |
| `close` | 마감 | 장 종료 후 마감 브리핑 (`kr` 전용) |
| `overnight` | 미국 밤사이 | 직전 미국장 종가 · 밤사이 뉴스 (`us` 전용) |

앱 **시장** 탭 회차(미장 · 장전 · 장중 · 마감)는 위 `session` 값과 1:1로 대응한다. 총 4회차다.

## Ingest Endpoint

- Method: `POST`
- URL: `/v1/market-briefings/ingest`
- Header: `x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN`

요청 본문 최상위(또는 `briefing` 객체와 형제)에 알림 플래그를 둔다. 기본값은 둘 다 `true`이며 서로 독립이다.

| 필드 | 역할 |
|---|---|
| `notifyInbox` | 알림센터(`notification_items`) 적재 |
| `sendPush` | 기기 푸시 큐 (`payload.pushDelivery: pending`) |

## 최소 Payload

```json
{
  "notifyInbox": true,
  "sendPush": true,
  "id": "kr-2026-06-14-morning",
  "market": "kr",
  "session": "morning",
  "title": "국내 아침 브리핑",
  "headline": "코스피는 반도체 강세와 환율 안정 기대를 중심으로 출발을 준비 중입니다.",
  "summary": "장 시작 전 핵심 이슈를 요약합니다.",
  "overview": [
    "삼성전자와 SK하이닉스 뉴스 흐름이 가장 강합니다.",
    "오늘 오전 발표 예정인 국내 지표는 제한적입니다."
  ],
  "sectors": [
    {
      "name": "반도체",
      "trend": "▲",
      "changePercent": 2.4,
      "symbol": "091160",
      "summary": "HBM·AI 관련 모멘텀이 업종 전반을 끌어올렸습니다."
    }
  ],
  "companies": [
    {
      "symbol": "005930",
      "name": "삼성전자",
      "summary": "외국인 수급 기대와 반도체 업황 개선 기대가 겹쳤습니다."
    }
  ],
  "macro": [
    {
      "title": "원/달러 환율",
      "summary": "야간 달러 약세가 유지되면 수출주 심리에 우호적입니다.",
      "sourceUrl": "https://example.com/fx-story",
      "sourceName": "Example News",
      "checkedAt": "2026-06-13T22:05:00Z",
      "recency": "latest"
    }
  ],
  "sourceRefs": [
    {
      "type": "news",
      "id": "codex-news:global:abc123",
      "relation": "primary"
    }
  ],
  "publishedAt": "2026-06-13T22:30:00Z",
  "briefingDate": "2026-06-14",
  "pushTitle": "국내 아침 브리핑 도착",
  "pushBody": "장 시작 전 핵심 이슈를 확인하세요."
}
```

## curl 예시

```bash
curl -X POST "$SIGNAL_SERVER_URL/v1/market-briefings/ingest" \
  -H "content-type: application/json" \
  -H "x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN" \
  --data @briefing.json
```

## Codex 자동화 프롬프트 가이드

국내 브리핑 자동화는 회차별로 `market=kr`, `session=morning|lunch|close`만 바꾸고 같은 형식으로 작성한다.
미국 브리핑 자동화는 `market=us`, `session=overnight`로 작성한다.

- 최신 기사와 시세는 반드시 웹 검증
- 기사 시각과 확인 시각 포함
- 오래된 기사와 최신 기사 구분
- 추정 수치는 `추정` 명시
- 종목 하이라이트에는 가능하면 `price`, `changePercent` 포함
- 섹터에는 가능하면 `changePercent`, `symbol`(대표 ETF·지수) 포함 — 앱 등락 칩 채색·외부 링크에 사용
- 섹터 `summary`는 **왜(해석)** 만 쓴다. `SMH 556 (-2.1%).` / `반도체 ETF -9%` 같은 시세 나열은 `changePercent`·`symbol`·companies로 보내고 summary에 반복하지 않는다
- 결과 생성 후 ingest endpoint로 POST

## 섹터 흐름 ↔ ETF 히트맵

앱 표시 역할 분리:

| 레이어 | 담는 정보 | 비고 |
|---|---|---|
| 시장 **섹터 흐름** 리스트 | `name` · 등락 · why | 히트맵 **순** 정렬. 채색은 **첫 행만**. 종목·티커는 UI에 미표시(본문/companies) |
| ETF **히트맵** 그리드 | `etf` · `changePercent` · sector | 시각 펄스 전용 |
| companies | 개별 종목 스토리 | 섹터 why와 겹치지 않게 종목 단위로 |

| 필드 | 필수 | 설명 |
|---|---|---|
| `name` | ✅ | 섹터명 |
| `trend` | 권장 | `▲` / `▽` / `→` — 수치 없을 때 칩 라벨·약한 채색 |
| `summary` | 권장 | **왜**만 (시세·종목 % 나열 금지에 가깝게) |
| `changePercent` | 권장 | 등락 칩·정렬. 없으면 summary의 `(-1.09%)` / `-9.49%` 파싱 |
| `symbol` / `etf` | 권장 | 대표 티커. 탭 시 국내 Naver · 해외 Yahoo |

역할 분담 표는 [DESIGN-GUIDE.md](./DESIGN-GUIDE.md) 보완 모델을 본다.

## 앱 표시

- 앱 **시장** 탭이 `/v1/market-briefings?locale=` 목록 API를 날짜·시장 필터로 읽는다.
- `sourceRefs`는 ingest 시 `type`+`id`만 저장하고 read 시 hydrate한다([`DIGEST-SOURCE-REF-HYDRATION.md`](./DIGEST-SOURCE-REF-HYDRATION.md)).
- 브리핑 전문은 탭 안에서 바로 표시한다(별도 상세 화면 없음).
- ingest 요청: `notifyInbox`(알림함), `sendPush`(기기 푸시) — 독립 플래그, 기본값 `true`
- 알림 `deepLink`는 `/signal`이다.
