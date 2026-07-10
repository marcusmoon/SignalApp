# 뉴스 번역 자동화 JSON 계약

뉴스 번역은 **Codex 예약 작업**이 담당한다. Signal Server Job은 원문만 수집한다.

1. Signal Server가 번역 안 된 뉴스 목록을 준다.
2. Codex가 번역한다.
3. Codex가 번역만 서버에 올린다.

예약 프롬프트: [`docs/prompts/news-translation.codex-scheduled-prompt.md`](./prompts/news-translation.codex-scheduled-prompt.md)

## 번역 안 됨 판정

대상 locale(기본 `ko`)에 아래 중 하나면 pending이다.

- 번역 row 없음
- `status`가 `completed`·`manual`이 아님 (`failed` 등)

`completed` 또는 `manual` 번역이 있으면 pending이 아니다.

앱 카드 표시는 `hasUsableTranslation()`으로 원문/번역을 결정한다. pending API·Admin missing 필터와는 별도다.

## Endpoint

### 1. 대상 조회

- Method: `GET`
- URL: `/v1/news/pending-translations`
- Header: `x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN`
- Query:
  - `target_locale` (기본 `ko`)
  - `category` (`global` | `korea` | `crypto`)
  - `from` (생략 시 최근 72시간)
  - `limit` (기본 `50`, 최대 `100`)
  - `offset` (기본 `0`)

정렬: `published_at DESC` (최신 우선)

### 2. 번역 적재

- Method: `POST`
- URL: `/v1/news/translations/ingest`
- Header: `x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN`

```json
{
  "items": [
    {
      "newsItemId": "codex-news:global:abc123",
      "locale": "ko",
      "provider": "codex",
      "status": "completed",
      "title": "연준, 금리 동결",
      "summary": "..."
    }
  ]
}
```

### 3. 뉴스 원문 적재

- Method: `POST`
- URL: `/v1/news/ingest`

뉴스 **원문만** 적재한다. 번역 필드는 받지 않는다.

## Admin 수동 재번역

Admin에서 선택 재번역은 `/admin/api/news/retranslate`와 Settings의 Provider 설정을 사용한다. Codex 자동화와 별도다.

## Codex 30분 run

```text
GET  /v1/news/pending-translations?target_locale=ko&category=global&limit=50
GET  /v1/news/pending-translations?target_locale=ko&category=crypto&limit=50
POST /v1/news/translations/ingest
```

## curl

```bash
curl "$SIGNAL_SERVER_URL/v1/news/pending-translations?target_locale=ko&category=global&limit=50" \
  -H "x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN"
```

```bash
curl -X POST "$SIGNAL_SERVER_URL/v1/news/translations/ingest" \
  -H "content-type: application/json" \
  -H "x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN" \
  --data '{"items":[{"newsItemId":"...","locale":"ko","provider":"codex","status":"completed","title":"...","summary":"..."}]}'
```
