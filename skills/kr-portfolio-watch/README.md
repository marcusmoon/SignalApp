# kr-portfolio-watch

중장기 트랙 보유 국내종목의 DART 공시를 매도 트리거로 분류해 대화창에 브리핑하는 Claude 스킬.
스킬 본문은 [SKILL.md](./SKILL.md), 스캐너는 [watch.py](./watch.py).

## 설치

스킬 디렉터리에 통째로 복사한다. 업로드형 환경에서는 `/mnt/skills/user/kr-portfolio-watch/`,
로컬 CLI에서는 `~/.claude/skills/kr-portfolio-watch/`.

```bash
cp -r skills/kr-portfolio-watch ~/.claude/skills/
cp ~/.claude/skills/kr-portfolio-watch/holdings.example.json \
   ~/.claude/skills/kr-portfolio-watch/holdings.json
```

`holdings.json`은 보유 현황이라 저장소에 커밋하지 않는다. 분기 리밸런싱 때 갱신한다.

## watch.py

`GET /v1/disclosures?market=kr` 만 호출한다. **쓰기 호출 없음** — ingest 토큰도 쓰지 않는다.

```
python3 watch.py [--holdings holdings.json] [--limit 300] [--hours 24]
```

서버 주소는 파일 상단 `BASE` 상수. 공개 API의 페이지 상한이 100이라 100건씩 끊어 `--limit`까지 받아온다.

### 출력

| 키 | 내용 |
|---|---|
| `holdings_hits` | 보유종목 공시. 심각도 → 비중 내림차순 정렬 |
| `action_required` | `holdings_hits` 중 SELL·NEEDS_CHECK |
| `universe_alerts` | 미보유 종목의 SELL·NEEDS_CHECK, 최대 15건 |
| `scanned` / `window_hours` / `holdings_count` / `asof` | 스캔 메타 |

보유종목 히트에는 `weight`와 `thesis_breakers`가 함께 실린다 (3단계 논리 훼손 점검용).

### 분류 규칙

`RULES` 리스트가 사양서 §8.1 트리거 표를 코드로 옮긴 것이다. 위에서부터 먼저 걸리는 규칙이 이긴다.
매칭 대상은 `formType + title + summary` 문자열이다.

## 알려진 동작

**1. `--hours 24`는 전일 공시를 놓친다.**
DART 접수일(`rcept_dt`)은 날짜 단위라 서버가 `filedAt`을 **KST 자정**으로 채운다
(`server/src/providers/news/dartFilings.mjs`의 `parseRceptDate`). 반면 컷오프는 실행 시각 기준이라,
전일 접수 공시는 실제로 24시간보다 더 과거로 계산된다.

전일 공시를 포함하려면 `--hours ≥ 24 + (현재 KST 시각)` 이 필요하다.
장 시작 전 08:00 KST 실행이면 32 이상, 11:30 실행이면 36 이상.

**SKILL.md 1단계는 `--hours 48`로 고정했다.** 실행 시각과 무관하게 전일분을 덮는다.
대신 전일 브리핑과 하루치가 겹치므로, 이미 다룬 항목을 반복하지 않는 책임은 브리핑 쪽에 있다
(SKILL.md 주의사항 참고).

**2. 해제·해소 공시가 SELL로 잡힌다.**
`관리종목` 패턴이 `관리종목지정해제`에도, `상장적격성` 패턴이 `상장적격성 실질심사 사유 해소`에도
걸린다. 브리핑 2단계에서 원문 제목을 확인해 걸러야 한다.

**3. `ticker`는 문자열 6자리로 적는다.**
공시 피드의 `symbol`과 정확히 일치해야 매칭된다. `5930`(숫자), `"005930.KS"`, `"A005930"`은
조용히 미매칭 처리되어 보유종목인데도 `universe_alerts`로 빠진다.

### `holdings.json`

`holdings.kospi30.seed.json`이 코스피 시총 상위 30 시드다. 그대로 복사해 쓰기 시작한 뒤
실제 보유 종목·비중으로 교체한다.

```bash
cp holdings.kospi30.seed.json holdings.json
```

종목·순서는 `server/src/screener/koreaScreenerUniverse.mjs`의 kospi 상위 30을 그대로 따랐다.
그 파일 주석대로 **실시간 KRX 시총 피드가 아니라 근사 순위**이므로, 순위 자체를 신뢰하지 말고
보유 종목 목록으로만 쓴다. 종목명은 `V2__seed_default_runtime_data.sql`의 이름 맵을 우선 사용했다.

시드의 `weight`는 전 종목 3.3 (균등) 자리표시자다.

`thesis_breakers`는 종목당 3문장씩 채워져 있으나 **초안이다** (`thesis_breakers_status: "draft"`).
각 기업의 공개된 사업구조에서 뽑은 것이지, Stage 3 정성검증 결과가 아니다.
초안은 3단계 동작 확인용이고, 실제 운용 전에 본인 문장으로 교체해야 한다.

문장은 관측 가능한 조건 + 방향성으로 쓴다. 공시로 확인·반증할 수 있어야 하고,
"전망이 나빠지면" 같은 판정 불가능한 서술은 쓰지 않는다.

| 필드 | 설명 |
|---|---|
| `positions[].ticker` | 6자리 종목코드 문자열. 필수 |
| `positions[].name` | 종목명 |
| `positions[].weight` | 포트폴리오 비중. 정렬 키이자 브리핑 표기값 |
| `positions[].thesis_breakers` | Stage 3 정성검증에서 적은 논리 훼손 조건 문장. 비면 3단계가 반만 동작한다 |
