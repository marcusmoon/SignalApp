# SIGNAL 에이전트 온보딩

## 원칙

- 앱은 Signal Server만 호출한다. 외부 provider 키와 호출은 서버/Admin에서 관리한다.
- 앱 피처 데이터 HTTP는 `integrations/signal-api/`에 둔다.
- 화면은 `app/`, 공용 UI는 `components/`, 제품 규칙은 `domain/`, 로컬 설정과 세션은 `services/`에 둔다.
- 서버는 `server/src/http/`, `server/src/db/`, `server/src/jobs/`, `server/src/providers/` 기준으로 나눈다.
- 문서는 현재 기준만 유지한다. 과거 이력은 남기지 않는다.
- **날짜·시간**은 [DATE-TIME.md](./DATE-TIME.md)를 따른다. 서버는 UTC, 앱 API는 UTC ISO, 표시는 로케일·기기 타임존.
- **화면 레이아웃·여백**은 [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md)와 `constants/screenLayout.ts`를 따른다.

## 피드 API 캐시

리스트·피드 화면의 HTTP 호출은 `integrations/signal-api/` 메모리 캐시(TTL)를 공통으로 쓴다.

- **기본** `cacheMode: 'use'` (`signalCacheMode()`): 필터·탭 전환·재진입. 캐시 hit이면 네트워크 없이 즉시 표시.
- **새로고침** `cacheMode: 'bypass'` (`signalCacheMode(true)`): 당겨서 새로고침만 네트워크 강제.
- **폴링·배지** (`newsUnreadPreference`, `disclosureUnreadPreference`, `signalUnreadPreference`): 최신 id 확인만 `bypass`.
- 화면마다 `listCacheRef`·`peekQuotes` 등 **중복 캐시를 두지 않는다** — API 레이어(`integrations/signal-api/cache/`)에 위임.
- All/속보 등 **서버 필터가 아닌 조건**은 클라이언트 필터(`domain/news/feedFilters.ts` 등)로 처리한다.

캐시 모듈(`integrations/signal-api/cache/`):

| 모듈 | API | TTL |
|---|---|---|
| `newsCache` | 뉴스·소스 | 2분 / 10분(소스) |
| `newsDigestsCache` | 뉴스 다이제스트 | 2분 |
| `communityCache` | 게시판 | 2분 |
| `disclosuresCache` | 공시 리스트 | 2분 |
| `disclosureDigestsCache` | 공시 다이제스트 | 2분 |
| `youtubeCache` | 유튜브·채널 | 2분 |
| `marketBriefingsCache` | 시장 브리핑 | 2분 |
| `todayBriefingsCache` | 오늘의 브리핑 | 2분 |
| `marketCache` | 시세·코인·마켓 리스트 | 5분 / 10분(리스트) |
| `calendarCache` | 캘린더 | 15분 |

설정에서 **캐시 삭제** 시 `clearSignalApiCache()`가 위 모듈을 모두 비운다.

## 실행

```bash
npm install
npm run start
npm run ios
npm run android
npm run web
npm run server:dev
npx tsc --noEmit
```

## 환경 변수

앱 공개 환경값은 `.env.example`을 기준으로 한다. 네이티브 키는 `EXPO_PUBLIC_*`로 노출하지 않는다.

- `EXPO_PUBLIC_SIGNAL_API_BASE_URL`: Signal Server 기본 URL
- `EAS_PROJECT_ID`: EAS Update / push token project id
- `KAKAO_NATIVE_APP_KEY`: Kakao Native SDK용 앱 키
- `SIGNAL_IOS_REMOTE_PUSH_ENABLED`: iOS remote push entitlement 사용 여부
- `SIGNAL_IOS_APPLE_SIGN_IN_ENABLED`: Sign in with Apple entitlement 사용 여부

## 자주 보는 파일

| 기능 | 파일 |
|---|---|
| 시그널 | `app/(tabs)/signal.tsx`, `components/signal/MarketBriefingBlock.tsx` |
| 뉴스 | `app/(tabs)/news.tsx`, `components/signal/NewsCard.tsx` |
| 뉴스 이슈 자동화 | [NEWS-ISSUE-AUTOMATION.md](./NEWS-ISSUE-AUTOMATION.md), [schemas/news-issue-digest.v1.schema.json](./schemas/news-issue-digest.v1.schema.json) |
| 오늘의 브리핑 자동화 | [TODAY-BRIEFING-AUTOMATION.md](./TODAY-BRIEFING-AUTOMATION.md) |
| 시세 | `app/(tabs)/quotes.tsx` |
| 더보기 | `app/(tabs)/more.tsx` |
| 유튜브 | `app/(tabs)/youtube.tsx` |
| 캘린더 | `app/calendar.tsx`, `components/signal/InvestMonthCalendar.tsx` |
| 계정 | `app/account.tsx`, `services/appAuthSession.ts` |
| Signal API | `integrations/signal-api/` |
| Admin | `server/src/public/admin/` |
| DB | `server/src/db/` |
| Job | `server/src/jobs/`, `server/src/worker.mjs` |
| 날짜·시간 | [DATE-TIME.md](./DATE-TIME.md), `utils/date.ts`, `server/src/time/utc.mjs` |
