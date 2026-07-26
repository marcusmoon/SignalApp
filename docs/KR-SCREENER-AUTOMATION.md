# 한국주 스크리너 자동화 연동

더보기 **스크리너** 메뉴용 큐레이션이다. 서버 Job이 유니버스·지표 스냅샷을 적재하고, Codex/Claude 예약 작업이 후지모토식 프리셋으로 후보 JSON을 만든 뒤 ingest한다. 앱은 GET으로만 읽는다.

에이전트 브리프(붙여넣기용): [`docs/prompts/kr-screener.agent-brief.md`](./prompts/kr-screener.agent-brief.md)  
예약 dry-run 프롬프트: [`docs/prompts/kr-screener.codex-scheduled-prompt.md`](./prompts/kr-screener.codex-scheduled-prompt.md)  
예제: [`docs/examples/kr-screener.ingest.example.json`](./examples/kr-screener.ingest.example.json)

## 역할 분담

| 담당 | 역할 |
|---|---|
| 서버 Job | 코스피 시총 상위 30 + 코스닥 시총 상위 50 선정, 가격·거래대금·RSI·(가능 시) PER·PBR·실적·배당 스냅샷 |
| Codex/Claude | 스냅샷 GET만 읽어 프리셋 필터·정렬·note JSON 생성 → dry-run 후 ingest |
| 앱 | `GET /v1/kr-screener` 등 스냅샷·큐레이션 조회. 외부 provider 호출 금지 |

모델이 PER·PBR·RSI·실적을 **추정·검색으로 채우면 안 된다.**

## 유니버스

| 시장 | 기준 | 개수 |
|---|---|---|
| 코스피 | 시가총액 상위 | 30 |
| 코스닥 | 시가총액 상위 | 50 |

보통주만. 우선주·스팩·관리/정리매매·거래정지 제외. 스크리너는 이 80종 밖을 쓰지 않는다.

## 시간 기준

- `generatedAt`, `asOf`, `snapshotAsOf`, `publishedAt`: UTC ISO 8601
- `generatedDate`: UTC `YYYY-MM-DD`
- 서버 저장·API 필터는 [DATE-TIME.md](./DATE-TIME.md)를 따른다.

## 구현 상태

| 레이어 | 상태 |
|---|---|
| Flyway | `V2__kr_screener.sql` (`kr_screener_snapshots`, `kr_screener_runs` + Job seed) |
| Job | `kr_screener_snapshot` — korea quotes/watchlist + `price_series` RSI. PER/PBR·실적은 quote payload에 있을 때만 |
| API | GET universe/snapshot/curation · POST snapshot/ingest · POST curation ingest |
| 앱 | 더보기 **스크리너** → `/screener` · 행 탭 → 종목 상세 |
| 유니버스 | 당분간 watchlist·적재된 국내 시세 시총 순위(최대 80). 정식 코스피30·코스닥50 피드는 후속 |

## Endpoints

`etf-insights`와 같이 **리소스 접두사 kebab-case** (`/v1/kr-screener`).  
앱 화면 경로는 `/screener`(푸시 deepLink 동일)로 API와 분리한다.

| Method | Path | 용도 |
|---|---|---|
| `GET` | `/v1/kr-screener` | 최신 큐레이션 (`?preset=fujimoto`, 선택 `?date=YYYY-MM-DD`) |
| `GET` | `/v1/kr-screener/universe` | 유니버스 심볼 목록 |
| `GET` | `/v1/kr-screener/snapshot` | 지표 스냅샷(Job 원천) |
| `POST` | `/v1/kr-screener/ingest` | 큐레이션 ingest (Codex/에이전트) |
| `POST` | `/v1/kr-screener/snapshot/ingest` | 스냅샷 ingest (Job·에이전트, 선택) |

### 유니버스·스냅샷 (Job 적재, 앱/에이전트 조회)

```text
GET /v1/kr-screener/universe
GET /v1/kr-screener/snapshot
GET /v1/kr-screener?preset=fujimoto
GET /v1/kr-screener?preset=fujimoto&date=YYYY-MM-DD
```

`/v1/kr-screener`는 최신 큐레이션(ingest 결과)을 반환한다. 스냅샷·유니버스는 Job 원천이다.

### Snapshot ingest (Job·에이전트, 선택)

- Method: `POST`
- URL: `/v1/kr-screener/snapshot/ingest`
- Header: `x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN`

풍부한 재무 필드(PER/PBR/YoY/배당)를 외부에서 채울 때 사용. Job이 만든 스냅샷을 덮어쓸 수 있다.

### Curation ingest (외부 에이전트)

- Method: `POST`
- URL: `/v1/kr-screener/ingest`
- Header: `x-signal-automation-token: $SIGNAL_AUTOMATION_INGEST_TOKEN`

| 필드 | 역할 |
|---|---|
| `notifyInbox` | 알림센터 적재 (기본 `true`) |
| `sendPush` | 기기 푸시 큐 (기본 `true`, `notifyInbox`와 독립) |

dry-run JSON은 둘 다 `false`. 확인 전에는 ingest하지 않는다.

## 후지모토식 프리셋 (`preset=fujimoto`)

스냅샷 수치가 모두 있을 때만 통과로 본다.

1. 매출 YoY > 0 AND 영업이익 YoY > 0 AND 순이익 YoY > 0  
2. PER > 0 AND PER ≤ 15  
3. PBR > 0 AND PBR ≤ 1  
4. 배당 있음 또는 증배 여력  
5. 일 거래대금 ≥ 서버 상수 `minTurnoverKrw`  
6. RSI ≤ 30  

정렬: RSI 오름차순 → 등락률 오름차순. 큐레이션 `items` 최대 20.

## 앱 UI

| 경로 | 동작 |
|---|---|
| 더보기 타일 **스크리너** | `/screener` |
| 화면 타이틀 | 성장·저평가 눌림 |
| 행 탭 | 기존 종목 상세 |
| 하단 탭·홈 상시 섹션 | 넣지 않음 |

1:2:6은 UI 가이드 문구만. 자동매매·주문 없음. 네이버 등은 종목 상세 외부 링크만.

## 권장 주기

| 레이어 | 주기 |
|---|---|
| 유니버스·재무 Job | 일 1회+ |
| 가격·대금·RSI Job | 장중 수 분~수십 분 |
| Codex/Claude dry-run·ingest | 장전·장후 각 1회(또는 1일 1회) |

## 최소 ingest payload

`docs/examples/kr-screener.ingest.example.json`을 본다. 요약:

- `schemaVersion`: 1  
- `run.preset`: `fujimoto`  
- `run.universe.kospiTop` / `kosdaqTop`: 30 / 50  
- `items[].symbol`: 6자리 국내 코드  
- `items[].note`: 투자 권유 없는 한국어 1문장  

## 운영 원칙

- dry-run 확인 전 `/v1/kr-screener/ingest` 호출 금지  
- Signal Server 응답에 없는 수치·종목을 만들지 않는다  
- 푸시 `deepLink`는 `/screener` (또는 확정 시 `/screener?date=<generatedDate>`)
