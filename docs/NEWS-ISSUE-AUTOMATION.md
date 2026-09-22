# 뉴스 이슈 자동화 JSON 계약

Codex 예약 작업은 먼저 Signal Server의 `/v1/news` 최신 뉴스만 읽어 **이슈 묶음 JSON을 dry-run으로 생성**해 사람이 확인한다. 확인이 끝난 JSON만 Signal Server의 `/v1/news-digests/ingest`에 적재한다. 앱은 이후 `/v1/news-digests`를 통해 이 결과를 읽는다.

운영 예약용 현재 프롬프트는 [뉴스 이슈 개정](./prompts/news-revisions.codex-scheduled-prompt.md)에 둔다. 신규 운영 작업은 v3를 사용한다. 아래 v2 규격은 기존 클라이언트/생성기 호환용이다.

## v3 개정 계약

- 스키마: [news-issue-digest.v3.schema.json](./schemas/news-issue-digest.v3.schema.json).
- `storyId`: 주체·사건·대상 기간으로 식별. 제목이나 실행 날짜를 키로 사용하지 않는다.
- `changeType`: `new`, `update`, `correction`. 후속/정정은 최신 `previousDigestId` 필수.
- `changes`: 추가/정정된 사실 1~3개와 각 사실의 `sourceIds`. 선택한 뉴스 근거만 참조한다.
- 서버가 내용 기반 `revisionId`와 `id`를 생성한다. 같은 요청 재전송은 재삽입하지 않으며 시각만 바꿔도 새 개정이 되지 않는다.
- 사건별 트랜잭션 잠금과 최신 predecessor 검증으로 오래된 작업의 덮어쓰기를 막는다. 충돌은 409이며 context를 다시 읽는다.
- `GET /v1/news-digests/context`는 ingest 인증 헤더가 필요하다. 최근 7일의 사건 최신 개정 최대 150건을 돌려준다.
- 공개 조회에 `storyId`(개정 이력), `symbols`(관심종목) 필터를 지원한다. 일반 목록은 사건별 최신 개정만 노출하며 날짜 범위 조회는 그 범위의 최신 개정을 사용한다.
- 서버 검증은 형식·근거 ID·순서·멱등성을 보장한다. 사실의 의미적 신규성이나 진실성을 자동 보증하지 않으므로 생성 지침과 표본 검수가 필요하다.

### 운영 전환

1. Flyway V21 인덱스를 적용한 뒤 서버를 배포한다. 기존 마이그레이션 수정/데이터 삭제는 없다.
2. `server/.env` 또는 예약 실행 환경에 `SIGNAL_AUTOMATION_INGEST_TOKEN`을 설정한다. 프롬프트/결과에 토큰을 넣지 않는다.
3. 저장소 루트에서 `node scripts/newsDigestAutomation.mjs collect`를 실행한다. v3 지원이 확인되지 않으면 중단된다.
4. 프롬프트에 따라 draft를 만들고 `validate`로 검증한다. 검토 후 `publish`로 게시한다. validate 자체는 게시하지 않는다.
5. 기존 Codex 예약 `news-digest-brief`는 이 프롬프트를 참조한다. 실행 시각·모델·PAUSED 상태는 유지했으며 재개는 별도 운영 결정이다.

뉴스 수집은 최근 14시간, 카테고리별 최대 300건이다. 제한에 걸리면 context의 `truncated`와 경고를 확인한다. 개정이 없는 실행은 게시하지 않는다. v2 사건과 v3 사건은 자동으로 제목 매칭하지 않아 초기 전환 기간에는 의미상 겹치는 카드가 남을 수 있다.

## Endpoint

- Method: `POST`
- URL: `/v1/news-digests/ingest`
- Header: `x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN`
- Schema: [v3](./schemas/news-issue-digest.v3.schema.json) (신규 운영), [v2](./schemas/news-issue-digest.v2.schema.json) (기존 호환). v1 스냅샷도 ingest 시 정규화되어 저장된다.
- Example: [`docs/examples/news-issue-digest.v2.ingest.example.json`](./examples/news-issue-digest.v2.ingest.example.json)

요청 최상위 `notifyInbox`·`sendPush`는 독립 플래그(기본 `true`). dry-run은 둘 다 `false`, 운영 ingest는 필요에 따라 조정한다. 항목별 알림 제외는 `notifyInbox: false`만 사용한다.

`articleTags`는 선택 사항이다. `[{ "newsItemId": "<sourceRef news id>", "hashtags": ["태그1", "태그2"] }]` 형식으로 이 실행에서 실제 `sourceRefs`로 쓴 기사에만 2~5개 태그를 보정한다. 수동 태그(`hashtagSource: manual`)는 절대 덮어쓰지 않으며, 선택 근거가 아닌 기사 id는 무시한다.

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
- `keywords`: 홈 스캔용 키워드. `{ label|symbol, kind?, weight?, name?, why? }` 권장 (`kind`: `theme`|`sector`|`symbol`|`macro`|`event`, 문서당 최대 6). **한국 6자리 종목은 `kind:"symbol"` + 티커 + 검증된 한글 `name`**, 미국 종목은 티커만 쓴다. **`why`/`reason`은 홈 랭크용 한 줄 맥락**. 문자열 배열도 ingest 가능(6자리 코드→symbol). 일반어(`시장`/`뉴스` 등) 금지. `topics`만 있으면 홈은 topics로 폴백
- `articleTags`: 선택한 `sourceRefs` 원문별 앱 뉴스 태그. title·summary·기존 태그에서 확인되는 2~5개 고유명사만 사용한다. 일반어·수치·중복·추측은 금지한다. 수동 태그 기사는 서버가 보존한다.
- 홈 UI: 최상단 **트렌드** 섹션 — 헤더(아이콘·제목·as-of) + 칩 카드(wrap · 최대 6) — 종목은 회사명. `why`는 ingest 유지(칩 a11y)
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
