# 뉴스 이슈 자동화 JSON 계약

Codex 예약 작업은 먼저 Signal Server의 `/v1/news` 최신 뉴스만 읽어 **이슈 묶음 JSON을 dry-run으로 생성**해 사람이 확인한다. 확인이 끝난 JSON만 Signal Server의 `/v1/news-digests/ingest`에 적재한다. 앱은 이후 `/v1/news-digests`를 통해 이 결과를 읽는다.

예약 기능에 그대로 넣을 프롬프트는 [`docs/prompts/news-issue-digest.codex-scheduled-prompt.md`](./prompts/news-issue-digest.codex-scheduled-prompt.md)에 둔다.

## Endpoint

- Method: `POST`
- URL: `/v1/news-digests/ingest`
- Header: `x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN`
- Schema: [`docs/schemas/news-issue-digest.v2.schema.json`](./schemas/news-issue-digest.v2.schema.json) (권장). v1 스냅샷도 ingest 시 정규화되어 저장된다.
- Example: [`docs/examples/news-issue-digest.v2.ingest.example.json`](./examples/news-issue-digest.v2.ingest.example.json)

요청 최상위 `notifyInbox`·`sendPush`는 독립 플래그(기본 `true`). dry-run은 둘 다 `false`, 운영 ingest는 필요에 따라 조정한다. 항목별 알림 제외는 `notifyInbox: false`만 사용한다.

## 생성 단위

예약 작업 1회는 하나의 `run`과 여러 `items`를 만든다. dry-run 단계에서는 `notifyInbox=false`, `sendPush=false`를 기본으로 둔다.

- `run`: 생성 시각, 대상 기간, 카테고리, 생성 정책
- `items`: 앱에 노출될 이슈 묶음 카드

카테고리는 현재 앱 기준과 맞춰 `global`, `korea`, `crypto`를 사용한다.

## 원천 데이터

dry-run 예약 작업은 외부 뉴스 사이트를 직접 검색하지 않는다. 아래 Signal Server 공개 API 응답만 사용한다.

```text
GET /v1/news?category=global&from=<UTC_FROM>&to=<UTC_TO>&limit=120&offset=0&locale=ko
GET /v1/news?category=korea&from=<UTC_FROM>&to=<UTC_TO>&limit=120&offset=0&locale=ko
GET /v1/news?category=crypto&from=<UTC_FROM>&to=<UTC_TO>&limit=120&offset=0&locale=ko
```

사용 가능한 원천 필드는 앱 뉴스 응답에 포함된 `id`, `title`, `originalTitle`, `sourceName`, `sourceUrl`, `publishedAt`, `symbols`, `hashtags`, `category`로 제한한다. 원문 사이트를 추가 조회하지 않는다.

## 묶음 기준

이슈 묶음은 아래 순서로 판단한다.

1. **중복 제거**: URL 동일, 제목 거의 동일, 같은 출처의 반복 송출은 하나로 본다.
2. **시간 범위**: 기본 24시간. 속보는 6~12시간, 실적·공시는 이벤트 날짜 기준.
3. **대상**: 종목, 기업명, 섹터, 매크로 키워드가 겹치는지 확인한다.
4. **이벤트 타입**: 실적, 제품, 규제, M&A, 공시, 매크로, 가격 급등락 등을 분리한다.
5. **출처 다양성**: 서로 다른 출처가 같은 내용을 다루면 묶음 신뢰도를 높인다. **같은 출처(provider/sourceName) 반복은 `sourceRefs`에 1건만** 넣고, 묶인 원문 수는 `count`로만 표현한다.
6. **`sourceRefs` 상한**: 이슈당 **최대 3** (primary 1 + supporting ≤2). 서로 다른 출처를 우선한다. 와이어 중복 헤드라인으로 refs를 채우지 않는다.

## items 필드

필수 필드:

- `id`: 안정적인 이슈 id. 같은 이슈를 재생성하면 같은 id를 쓴다.
- `category`: `global` | `korea` | `crypto`
- `title`: 앱 카드 제목
- `summary`: 1~3문장 요약
- `generatedDate`: UTC 기준 생성일 `YYYY-MM-DD`
- `generatedAt`: UTC ISO 시각
- `groupKey`: 사람이 읽을 수 있는 묶음 키
- `sourceRefs`: 원문 뉴스 목록 — **최대 3**. **v2 ingest**에서는 `type`+`id`(+`relation`)만 넣는다. `title`·`url`·`sourceName`은 생략. 앱 표시는 read 시 `news_items`·번역을 hydrate([`DIGEST-SOURCE-REF-HYDRATION.md`](./DIGEST-SOURCE-REF-HYDRATION.md)). 같은 출처 중복은 넣지 않는다.

권장 필드:

- `symbols`: 관련 종목 코드
- `topics`: 대표 주제 태그 (카드 trail·기존 UI)
- `keywords`: 홈 스캔용 키워드. `{ label|symbol, kind?, weight?, name?, why? }` 권장 (`kind`: `theme`|`sector`|`symbol`|`macro`|`event`, 문서당 최대 6). **종목은 `kind:"symbol"` + 티커 + `name`(회사명)**. **`why`/`reason`은 홈 랭크용 한 줄 맥락**. 문자열 배열도 ingest 가능(6자리 코드→symbol). 일반어(`시장`/`뉴스` 등) 금지. `topics`만 있으면 홈은 topics로 폴백
- 홈 UI: 최상단 **카드 + 태그 아이콘 + wrap 칩**(헤더 없음 · 최대 6) — 종목은 회사명. `why`는 ingest 유지(칩 a11y)
- `sources`: (v2 ingest 생략) read 시 hydrate된 `sourceRefs`에서 파생
- `count`: 묶인 원문 수
- `primaryNewsId`, `primaryPublishedAt`: 대표 기사
- `cluster`: 묶음 판단 근거
- `impact`: 사용자에게 보여줄 영향 방향
- `pushTitle`, `pushBody`: 알림 제목·본문 (선택)
- `notifyInbox`: (선택) 항목별 알림함 제외 시 `false`. 생략 시 요청 `notifyInbox` 따름

`score`는 생성 JSON에서 쓰지 않는다. 서버 ingest는 현재 입력 순서 기반으로 점수를 재계산하므로, 중요도는 `items` 배열 순서로 표현한다.

## Codex 예약 작업 출력 규칙

예약 작업은 최종 응답으로 JSON만 생성한다.

- Markdown 금지
- 설명 문장 금지
- 날짜·시각은 UTC ISO 사용
- 원문 URL과 출처 시각은 확인 가능한 경우만 입력
- 추정이면 `cluster.confidence`를 낮추고 `summary`에 단정 표현을 피한다.
- 오래된 기사와 최신 기사가 섞이면 최신 기사 중심으로 제목을 정한다.

## 최소 curl

```bash
curl -X POST "$SIGNAL_SERVER_URL/v1/news-digests/ingest" \
  -H "content-type: application/json" \
  -H "x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN" \
  --data @docs/examples/news-issue-digest.v2.ingest.example.json
```

## 앱 반영 방향

1. 현재 뉴스 상단 주요이슈는 `/v1/news-digests`를 그대로 사용한다.
2. 다음 단계에서 `cluster`, `impact`, `sourceRefs`를 앱 UI에 더 노출한다.
3. 이슈 상세 화면은 `sourceRefs`를 기준으로 원문 뉴스·영상·공시를 연결한다.
