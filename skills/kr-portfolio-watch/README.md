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
python3 watch.py [--hours 24] [--holdings PATH] [--base-url URL] [--max-rows 300]
```

`--base-url` 기본값은 `https://signalapp.up.railway.app`이며 `SIGNAL_BASE_URL`로도 바꿀 수 있다.

종료 코드: `0` 정상 · `2` holdings.json 없음/형식 오류 · `3` 피드 조회 실패.
실패해도 stdout에 `{"ok": false, "error": ...}` JSON을 남기므로 브리핑에서 한 줄로 보고할 수 있다.

### 분류 규칙

`RULES` 리스트가 사양서 §8.1 트리거 표를 코드로 옮긴 것이다. 위에서부터 먼저 걸리는 규칙이 이긴다.
DART 보고서명(`formType`)과 제목을 접두 태그(`[기재정정]` 등) 제거 + 공백 제거 후 정규식으로 검사한다.

`NEEDS_CHECK`로 올리는 트리거는 반드시 `NEEDS_CHECK_CRITERIA`에 매도/유지 기준이 있어야 한다.
기준 없는 트리거를 `NEEDS_CHECK`로 두면 브리핑 2단계에서 판정 기준을 붙일 수 없다.

### 시간 윈도우

DART 접수일은 날짜 단위(KST 자정)로 들어온다. 자정 그대로 비교하면 당일 공시가 윈도우 밖으로
밀려나므로, 시각이 KST 자정인 행은 그날 마감(23:59:59 KST)으로 보정해 `--hours`와 비교한다.

### `holdings.json`

| 필드 | 설명 |
|---|---|
| `holdings[].symbol` | 6자리 종목코드. `005930.KS`, `A005930`도 6자리로 정규화된다 |
| `holdings[].name` | 종목명 (없으면 공시의 `companyName` 사용) |
| `holdings[].weight` | 포트폴리오 비중. 브리핑에 그대로 표기된다 |
| `holdings[].thesis_breakers` | Stage 3 정성검증에서 적은 논리 훼손 조건 문장. 비면 3단계가 반만 동작한다 |
| `watchlist` | (선택) 후보군 종목코드. 있으면 `universe_alerts`를 이 목록으로 좁힌다 |
