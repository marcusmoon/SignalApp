# 뉴스 번역 자동화 JSON 계약

뉴스 번역은 Signal Server Job이 아니라 **Codex 예약 작업**이 담당한다.

1. Signal Server가 번역 안 된 뉴스 목록을 준다.
2. Codex가 번역한다.
3. Codex가 번역만 서버에 올린다.

예약 프롬프트: [`docs/prompts/news-translation.codex-scheduled-prompt.md`](./prompts/news-translation.codex-scheduled-prompt.md)

## 번역 안 됨 판정 (단순 규칙)

대상 locale(기본 `ko`)에 아래 중 하나면 pending이다.

- 번역 row 없음
- `status`가 `completed`·`manual`이 아님 (`failed` 등)
- `provider=mock` (과거 Job 자동번역 잔여분)

`completed` + `manual` 번역이 있으면 pending이 아니다. 앱 표시 품질 검사(`hasUsableTranslation`)는 앱·Admin 전용이며 pending API에는 쓰지 않는다.

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

응답 `data[]`:

- `id`, `category`, `titleOriginal`, `summaryOriginal`, `contentOriginal`
- `sourceName`, `sourceUrl`, `imageUrl`, `symbols`, `publishedAt`, `targetLocale`

### 2. 번역 적재 (권장)

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

`newsItemId`는 pending 조회 응답의 `id`를 그대로 쓴다. 뉴스 본문 전체를 다시 보낼 필요 없다.

### 3. 뉴스+번역 일괄 적재 (선택)

- Method: `POST`
- URL: `/v1/news/ingest`

신규 뉴스 수집과 번역을 한 번에 올릴 때만 사용한다. Codex 번역 run은 `/v1/news/translations/ingest`를 쓴다.

## Codex 30분 run 흐름

```text
GET  /v1/news/pending-translations?target_locale=ko&category=global&limit=50
GET  /v1/news/pending-translations?target_locale=ko&category=crypto&limit=50
POST /v1/news/translations/ingest
```

`data`가 비어 있으면 종료. `meta.hasMore=true`이면 `offset`을 올려 같은 run에서 반복한다.

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
