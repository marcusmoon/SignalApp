# 날짜·시간 (UTC) 규칙

SIGNAL은 **서버 저장·API 통신은 UTC**, **앱 표시는 사용자 로케일·기기 타임존**을 따른다.

## 원칙

| 구분 | 기준 |
|---|---|
| 서버 DB·ingest·공개 API 응답의 instant | UTC (`timestamptz`, ISO 8601 `…Z`) |
| 앱 → 서버 instant 필터 (`from` / `to`) | 로컬 캘린더 일자를 UTC ISO 범위로 변환해 전송 |
| 앱 화면 표시 | 앱 언어(`ko`/`en`/`ja`) + **기기 시스템 타임존** (`Intl`) |
| 캘린더 `event_date` | 시장 캘린더 날짜 (`date`, 타임존 없음) |
| 캘린더 `event_at` | UTC instant + `timezone` / `time_label` 메타 |

앱은 서버에 `timeZone` 쿼리 파라미터를 보내지 않는다.

## 서버

### 저장

- **Instant 컬럼** (`published_at`, `filed_at`, `generated_at`, `event_at`, `fetched_at` 등): Postgres `timestamptz`, 값은 UTC.
- **날짜-only 컬럼** (`briefing_date`, `digest_date`, `generated_date`, `event_date` 등): Postgres `date`. 의미에 맞는 캘린더 날짜(대부분 UTC 일자 또는 시장 일자)만 저장한다.
- Postgres pool은 세션 `timezone=UTC`를 사용한다 (`server/src/db/postgres/client.mjs`).

### ingest·정규화

- 타임스탬프 문자열은 `server/src/time/utc.mjs`의 `parseToUtcIsoOrNull()`로 UTC ISO로 맞춘 뒤 DB에 넣는다.
- 날짜-only는 `utcDateOnlyOrNull()` / `utcDateKeyFromInstant()`로 `YYYY-MM-DD`를 만든다.
- **외부 API가 로컬 캘린더 날짜를 요구하는 경우**(예: DART `bgn_de`/`end_de`)는 해당 API 규칙의 IANA 타임존(한국 `Asia/Seoul`)으로 YMD를 만든다. 서버 내부 저장 기준과 혼동하지 않는다.

### API 필터 (`from` / `to`)

- Instant 컬럼 필터는 **항상 `timestamptz` 비교**만 한다. `published_at::date`, `COALESCE(…, generated_at::date)` 같은 세션 타임존 의존 cast는 쓰지 않는다.
- `YYYY-MM-DD`만 오면:
  - `from` → `YYYY-MM-DDT00:00:00.000Z`
  - `to` → `YYYY-MM-DDT23:59:59.999Z`
- 전체 ISO instant가 오면 그대로 경계로 사용한다.
- 구현: `sqlUtcRangeFrom()` / `sqlUtcRangeTo()` (`server/src/time/utc.mjs`, `server/src/db/repositories/publicHelpers.mjs`).

### 캘린더 예외

`calendar_events`만 이중 모델을 쓴다 (`V29__calendar_event_utc_market_dates.sql`).

| 필드 | 의미 |
|---|---|
| `event_date` | 시장·국가 기준 **캘린더 날짜** (월 그리드·일별 목록) |
| `event_at` | 이벤트 **UTC 시각** |
| `timezone`, `time_label` | 표시용 IANA 타임존·라벨 |

캘린더 API의 `from`/`to`(날짜-only)는 `event_date`에 대응한다. instant 범위 필터는 `event_at`에 쓴다.

## 앱

### 서버 통신

- 사용자가 고른 **로컬 일자**(`toYmd`, 날짜 피커)를 instant API에 넘길 때는 `utcRangeForLocalYmd(ymd)` (`utils/date.ts`)로 변환한다.
  - 로컬 해당일 `00:00:00.000` ~ `23:59:59.999` → `.toISOString()` (UTC `Z`)
- 종목 뉴스 lookback 등 기간 조회도 동일하게 **시작·끝 로컬 일자 각각**을 UTC 범위로 보낸다 (`services/companyNewsForSymbol.ts`).
- 캘린더 월/일 조회는 `event_date`용이므로 `toYmd()` **문자열만** 보낸다 (`integrations/signal-api/calendarRange.ts`).

### 화면 표시

| 용도 | 함수 |
|---|---|
| 상대 시각 (“3시간 전”) | `formatRelativeFromIso` |
| 날짜만 | `formatLocalInstantDate` |
| 날짜+시간 | `formatInstantLabel` |
| 로컬 YMD 제목 | `formatLocalYmdLabel` |

- `Intl.DateTimeFormat`에 `timeZone`을 생략하면 **기기 시스템 타임존**이 적용된다.
- 캘린더 이벤트 시각만 서버 `timezone`(ET, KST 등)을 `Intl`에 명시한다 (`app/calendar.tsx`).
- 앱 **언어**(`LocaleContext`, `ko`/`en`/`ja`)는 OS 언어를 자동 따르지 않는다. 저장된 앱 설정을 쓰고, 날짜 포맷 태그는 `localeTagForAppLocale()`로 매핑한다.

### “오늘”

- 로컬 오늘: `todayLocalYmd()` / `toYmd(new Date())`.
- 자정 넘김·포커스 갱신: `hooks/useRollingLocalYmd.ts`.

## 구현 위치 (참고)

| 영역 | 파일 |
|---|---|
| 서버 UTC 헬퍼 | `server/src/time/utc.mjs` |
| Repository SQL 경계 | `server/src/db/repositories/publicHelpers.mjs` |
| 앱 날짜 유틸 | `utils/date.ts` |
| 로컬 오늘 갱신 | `hooks/useRollingLocalYmd.ts` |
| 캘린더 스키마 | `server/db/migrations/postgres/V29__calendar_event_utc_market_dates.sql` |

## 새 코드 작성 시

1. **서버**: instant는 UTC ISO로 저장·응답. 필터는 `timestamptz` + `sqlUtcRangeFrom`/`To`.
2. **앱 API 호출**: instant 범위는 `utcRangeForLocalYmd`. 캘린더 날짜는 `YYYY-MM-DD` only.
3. **앱 UI**: ISO 문자열을 slice·`getUTC*`로 직접 포맷하지 말고 `utils/date.ts` 헬퍼 또는 `Intl`을 쓴다.
4. **예외 추가 시**: 이 문서와 `docs/ARCHITECTURE.md`에 이유를 적는다.
