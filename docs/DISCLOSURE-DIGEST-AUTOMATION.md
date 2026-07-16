# 공시 다이제스트 자동화 JSON 계약

공시 다이제스트는 **Signal Admin Job이 만들지 않는다.** 외부 에이전트(Codex 예약 등)가 Signal Server 공시 목록을 읽고 묶음 JSON을 만든 뒤 `/v1/disclosure-digests/ingest`로 올린다. 앱은 `/v1/disclosure-digests`로 읽는다.

`server/src/digests/disclosureDigest.mjs`의 로컬 생성기는 운영 경로가 아니다(개발·검증용 참고 구현).

## Endpoint

- Method: `POST`
- URL: `/v1/disclosure-digests/ingest`
- Header: `x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN`
- Schema: [`docs/schemas/disclosure-digest.v1.schema.json`](./schemas/disclosure-digest.v1.schema.json)
- Example: [`docs/examples/disclosure-digest.v1.ingest.example.json`](./examples/disclosure-digest.v1.ingest.example.json)

요청 최상위 `notifyInbox`·`sendPush`는 독립 플래그(기본 `true`). dry-run은 둘 다 `false`.

## 원천 데이터

외부 사이트를 추가 크롤하지 않는다. Signal Server 공개 API만 사용한다.

```text
GET /v1/disclosures?market=us&limit=120&offset=0
GET /v1/disclosures?market=kr&limit=120&offset=0
```

사용 필드: `id`, `market`, `provider`, `symbol`, `companyName`, `formType`, `typeCategory`, `title`, `summary`, `url`, `filedAt`, `periodEndDate`.

## 묶음 기준

1. **회사/심볼** 단위로 묶는다 (같은 날·같은 시장의 동일 종목).
2. **중요도**: `8-K`·`6-K`·주요사항보고서·공정/조회공시 등을 우선 대표로 고른다.
3. 정기보고(10-Q/10-K/사업·분기·반기)는 묶되 중요 이벤트보다 뒤로.

## items 필드

필수:

| 필드 | 설명 |
|---|---|
| `id` | 안정 id. 예: `disclosure-digest:YYYY-MM-DD:<hash>` |
| `market` | `us` \| `kr` |
| `title` | 카드 제목. **대표 공시 `title`을 쓰거나** `{회사} · {의미}` 한 줄 |
| `summary` | **대표 공시 `summary`(또는 그 한 줄 재서술).** `2건 · DART` 같은 메타만 쓰지 말 것 |
| `generatedDate` | UTC `YYYY-MM-DD` |
| `generatedAt` | UTC ISO |
| `sourceRefs` | `{ "type": "disclosure", "id": "<disclosureId>" }` (+ optional `relation`) |

권장:

| 필드 | 설명 |
|---|---|
| `symbols`, `companies`, `forms` | 칩·필터용 |
| `count` | 묶인 공시 수 |
| `importance` | `0` 일반 · `1` 정기/중간 · `2` 중요 이벤트. 앱 **중요** 필터·뱃지에 사용 |
| `primaryDisclosureId` | 대표 공시 id (상세 진입) |
| `groupKey` | 재생성 안정 키 |
| `pushTitle`, `pushBody` | 알림 문구 |
| `notifyInbox` | 항목별 알림함 제외 시 `false` |

`score`는 생략 가능. 서버가 배열 순서로 보강한다.

### summary 작성 규칙 (앱 가독성)

- 대표 공시의 `summary` 또는 `title`에서 **무엇이 공시됐는지**가 드러나게 한다.
- SEC 8-K는 Item 라벨이 있으면 그 의미를 살린다.
- DART는 `formType`/`report_nm`에 구체 키워드가 있으면 그걸 남긴다.
- 금지: `2건 · SEC/DART · 10-Q`처럼 건수·출처만인 메타 문장.

### importance

- `2`: 8-K, 6-K, 주요사항보고서, 공정공시, 조회공시 등
- `1`: 10-Q/10-K/20-F, 사업·반기·분기보고서
- `0`: 그 외
- 생략 시 서버가 `forms`로 추론할 수 있으나, 에이전트가 명시하는 것을 권장한다.

## 조회

```text
GET /v1/disclosure-digests?market=us&limit=16&batches=1&locale=ko
```

`sourceRefs`는 ingest 시 `type`+`id`만 저장하고 read 시 hydrate한다([`DIGEST-SOURCE-REF-HYDRATION.md`](./DIGEST-SOURCE-REF-HYDRATION.md)).
