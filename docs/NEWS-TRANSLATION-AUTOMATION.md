# 뉴스 번역 자동화 JSON 계약

Codex 예약 작업은 Signal Server의 `/v1/news/pending-translations`로 번역 대상 뉴스를 읽고, 번역한 뒤 `/v1/news/ingest`에 적재한다. 앱은 이후 `/v1/news`를 통해 번역된 제목·요약을 읽는다.

예약 기능에 그대로 넣을 프롬프트는 [`docs/prompts/news-translation.codex-scheduled-prompt.md`](./prompts/news-translation.codex-scheduled-prompt.md)에 둔다.

## Endpoint

### 대상 조회

- Method: `GET`
- URL: `/v1/news/pending-translations`
- Header: `x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN`
- Query:
  - `target_locale` (기본 `ko`)
  - `category` (`global` | `korea` | `crypto`, 생략 시 전체)
  - `from` (UTC ISO 또는 `YYYY-MM-DD`, 선택)
  - `limit` (기본 `50`, 최대 `100`)
  - `offset` (기본 `0`)

대상 판정은 Admin의 `translationStatus=missing`과 동일하게 `hasUsableTranslation()` 기준을 따른다.

- 번역 row 없음
- `failed` 등 미완료 상태
- `provider=mock`
- 제목·요약이 비어 있거나 원문과 동일한 `completed` 번역

응답 `data[]` 필드:

- `id`, `category`, `titleOriginal`, `summaryOriginal`, `contentOriginal`
- `sourceName`, `sourceUrl`, `imageUrl`, `symbols`, `publishedAt`
- `targetLocale`
- `existingTranslation` (있을 때만: `status`, `provider`, `errorMessage`)

### 번역 적재

- Method: `POST`
- URL: `/v1/news/ingest`
- Header: `x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN`

각 item은 대상 조회 응답을 기반으로 `translation` 또는 `translations.ko`를 포함한다.

```json
{
  "items": [
    {
      "id": "codex-news:global:abc123",
      "category": "global",
      "titleOriginal": "Fed holds rates steady",
      "summaryOriginal": "...",
      "sourceName": "Reuters",
      "sourceUrl": "https://example.com/article",
      "publishedAt": "2026-07-10T12:00:00.000Z",
      "translation": {
        "locale": "ko",
        "provider": "codex",
        "status": "completed",
        "title": "연준, 금리 동결",
        "summary": "..."
      }
    }
  ]
}
```

## Codex 예약 작업 흐름

1. `GET /v1/news/pending-translations?target_locale=ko&limit=20` 로 대상을 가져온다.
2. `data`가 비어 있으면 이번 run은 종료한다.
3. 각 item의 `titleOriginal`, `summaryOriginal`, `contentOriginal`을 한국어로 번역한다.
4. `POST /v1/news/ingest`로 `translation`을 포함해 적재한다.
5. `meta.hasMore=true`이면 `offset`을 올려 1~4를 반복한다.

## 최소 curl

```bash
curl "$SIGNAL_SERVER_URL/v1/news/pending-translations?target_locale=ko&limit=20" \
  -H "x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN"
```

```bash
curl -X POST "$SIGNAL_SERVER_URL/v1/news/ingest" \
  -H "content-type: application/json" \
  -H "x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN" \
  --data '{"items":[{"id":"...","category":"global","titleOriginal":"...","summaryOriginal":"...","sourceName":"...","sourceUrl":"https://...","translation":{"locale":"ko","provider":"codex","status":"completed","title":"...","summary":"..."}}]}'
```
