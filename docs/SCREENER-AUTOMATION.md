# 스크리너 자동화 연동

더보기 **스크리너** 메뉴용 큐레이션이다.

- **market**: `kr` | `global` — 시장별 종목풀(풀)을 분리한다.
- **pool**: market당 공용 유니버스·지표 스냅샷. **모든 method가 동일 풀을 읽는다.**
- **method**: 큐레이션 방식(모델). 예: `fujimoto`. 이후 method를 추가해도 풀 API는 그대로다.

서버 Job이 market별 풀 스냅샷을 적재하고, Codex/Claude가 method별 후보 JSON을 만든 뒤 ingest한다. 앱은 GET으로만 읽는다.

에이전트 브리프: [`docs/prompts/screener.agent-brief.md`](./prompts/screener.agent-brief.md)  
예약 dry-run: [`docs/prompts/screener.codex-scheduled-prompt.md`](./prompts/screener.codex-scheduled-prompt.md)  
예제: [`docs/examples/screener.ingest.example.json`](./examples/screener.ingest.example.json)

## 역할 분담

| 담당 | 역할 |
|---|---|
| 서버 Job | market별 풀 선정·가격·거래대금·RSI·(가능 시) 재무 스냅샷 |
| Codex/Claude | `GET …/pool/snapshot`만 읽어 method 필터·정렬·note JSON → dry-run 후 ingest |
| 앱 | `GET /v1/screener?market=&method=` 등. 외부 provider 호출 금지 |

모델이 PER·PBR·RSI·실적을 **추정·검색으로 채우면 안 된다.**

## 시장·유니버스

| market | 유니버스(목표) | Job |
|---|---|---|
| `kr` | 코스피 시총 상위 30 + 코스닥 시총 상위 50 | `screener_pool_kr` |
| `global` | (후속) 글로벌 대형주 풀 | ingest 또는 후속 Job |

KR: 보통주만. 우선주·스팩·관리/정리매매·거래정지 제외. method는 해당 market 풀 밖 종목을 쓰지 않는다.

## 시간 기준

- `generatedAt`, `asOf`, `snapshotAsOf`, `publishedAt`: UTC ISO 8601
- `generatedDate`: UTC `YYYY-MM-DD`
- [DATE-TIME.md](./DATE-TIME.md)

## 구현 상태

| 레이어 | 상태 |
|---|---|
| Flyway | `V2__screener.sql` — `screener_snapshots`(market), `screener_runs`(market+method) + Job seed |
| Job | `screener_pool_kr` / handler `screener_pool_snapshot` |
| API | pool · methods · runs · convenience GET |
| 앱 | 더보기 **스크리너** → `/screener?market=kr&method=fujimoto` |
| global 풀 | 아직 Job 없음 — `POST /v1/screener/pool/snapshot/ingest`로 seed 가능 |

## Endpoints

앱 화면 경로 `/screener`와 API 경로 `/v1/screener…`는 분리한다.

| Method | Path | 용도 |
|---|---|---|
| `GET` | `/v1/screener/pool/universe?market=` | 공용 유니버스 심볼 |
| `GET` | `/v1/screener/pool/snapshot?market=` | 공용 지표 스냅샷 (모든 method 원천) |
| `POST` | `/v1/screener/pool/snapshot/ingest` | 풀 스냅샷 ingest (Job·에이전트) |
| `GET` | `/v1/screener/methods?market=` | 알려진 method 카탈로그 |
| `GET` | `/v1/screener/runs?market=&method=` | 큐레이션 목록 |
| `GET` | `/v1/screener/runs/:id` | 큐레이션 단건 |
| `POST` | `/v1/screener/runs/ingest` | method 큐레이션 ingest |
| `GET` | `/v1/screener?market=&method=` | 앱용 최신(또는 `?date=`) 큐레이션 |

`market` 쿼리는 필수(`kr`|`global`). `method` 기본값은 `fujimoto`.

### Pool ingest

- `POST /v1/screener/pool/snapshot/ingest`
- Header: `x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN`
- Body에 `market` 필수. 재무 필드를 외부에서 채울 때 Job 스냅샷을 덮어쓸 수 있다.

### Runs ingest

- `POST /v1/screener/runs/ingest`
- Header: `x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN`

| 필드 | 역할 |
|---|---|
| `run.market` | `kr` \| `global` |
| `run.method` | 예: `fujimoto` (레거시 `preset`도 수용) |
| `run.poolSnapshotId` | 사용한 풀 스냅샷 id (권장) |
| `notifyInbox` / `sendPush` | 알림·푸시 (dry-run은 둘 다 `false`) |

## method: `fujimoto` (KR)

스냅샷 수치가 모두 있을 때만 통과.

1. 매출 YoY > 0 AND 영업이익 YoY > 0 AND 순이익 YoY > 0  
2. PER > 0 AND PER ≤ 15  
3. PBR > 0 AND PBR ≤ 1  
4. 배당 있음 또는 증배 여력  
5. 일 거래대금 ≥ `policy.minTurnoverKrw`  
6. RSI ≤ 30  

정렬: RSI 오름차순 → 등락률 오름차순. `items` 최대 20.

새 method를 추가할 때: 풀 GET은 그대로 두고, ingest의 `run.method`·필터 규칙·앱 `?method=`만 추가하면 된다.

## 앱 UI

| 경로 | 동작 |
|---|---|
| 더보기 **스크리너** | `/screener` (기본 `market=kr`, `method=fujimoto`) |
| deepLink | `/screener?market=&method=` |
| 행 탭 | 종목 상세 |
| 하단 탭·홈 상시 섹션 | 없음 |

## 권장 주기

| 레이어 | 주기 |
|---|---|
| 풀 Job (시세·RSI) | 장중 수 분~수십 분 / 재무는 일 1회+ |
| method dry-run·ingest | 장전·장후 각 1회(또는 1일 1회) |

## 운영 원칙

- dry-run 확인 전 `/v1/screener/runs/ingest` 금지  
- 풀 스냅샷에 없는 수치·종목을 만들지 않는다  
- 같은 market의 method끼리 풀을 공유한다 (method별 유니버스 복제 금지)
