# 시장 브리핑 자동화 연동

국내/미국 시장 브리핑 자동화는 Signal Server에 먼저 적재한 뒤 앱이 `/v1/market-briefings`로 읽도록 연결한다.

## 권장 스케줄

- 국내 오전(`morning`): 매 영업일 오전 7:30 KST — 장 시작 전
- 국내 오후(`lunch`): 매 영업일 오후 12:10 KST — 점심
- 국내 저녁(`evening`): 매 영업일 오후 6:00 KST — 장 마감 후
- 미국 밤사이(`overnight`): 매 영업일 오전 6:30 KST

## 국내 session 기준

실행 시각(한국 시간)에 따라 `session`을 정한다.

| session | 실행 시점 | 작성 초점 |
|---|---|---|
| `morning` | 장 시작 전 | 장 시작 전 관전 포인트 |
| `lunch` | 점심 | 오전장 흐름과 오후장 변수 |
| `evening` | 저녁 | 장 마감 요약과 다음 거래일 체크포인트 |

앱 **시그널** 탭 국내 필터(오전/오후/저녁)는 위 `session` 값과 1:1로 대응한다.

## Ingest Endpoint

- Method: `POST`
- URL: `/v1/market-briefings/ingest`
- Header: `x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN`

## 최소 Payload

```json
{
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
      "kind": "news",
      "title": "반도체 업황 관련 기사",
      "url": "https://example.com/story",
      "sourceName": "Example News",
      "publishedAt": "2026-06-13T21:40:00Z"
    }
  ],
  "publishedAt": "2026-06-13T22:30:00Z",
  "briefingDate": "2026-06-14",
  "pushCandidate": true,
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

국내 브리핑 자동화는 회차별로 `market=kr`, `session=morning|lunch|evening`만 바꾸고 같은 형식으로 작성한다.
미국 브리핑 자동화는 `market=us`, `session=overnight`로 작성한다.

- 최신 기사와 시세는 반드시 웹 검증
- 기사 시각과 확인 시각 포함
- 오래된 기사와 최신 기사 구분
- 추정 수치는 `추정` 명시
- 종목 하이라이트에는 가능하면 `price`, `changePercent` 포함
- 결과 생성 후 ingest endpoint로 POST

## 앱 표시

- 앱 **시그널** 탭이 `/v1/market-briefings` 목록 API를 날짜·시장 필터로 읽는다.
- 브리핑 전문은 탭 안에서 바로 표시한다(별도 상세 화면 없음).
- `pushCandidate=true` ingest 시 푸시 `deepLink`는 `/signal`이다.
