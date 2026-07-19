# SIGNAL 에이전트 온보딩

## 문서 목록

| 문서 | 용도 |
|---|---|
| [APP-UI-PLAYBOOK.md](./APP-UI-PLAYBOOK.md) | **다른 앱 이식용** UI 운영 표준·체크리스트 |
| [DESIGN-GUIDE.md](./DESIGN-GUIDE.md) | **앱 UI·UX** — 테마, 타이포, 레이아웃, 컴포넌트 |
| [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md) | **앱 개발** — 디렉터리, API, 캐시, 외부 링크, 로케일 |
| [FEED-INTERACTION.md](./FEED-INTERACTION.md) | PTR·chip·폴링·피드 캐시 상호작용 |
| [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md) | Safe Area·여백·고정 헤더·2-pane 레이아웃 |
| [DATE-TIME.md](./DATE-TIME.md) | UTC·API·표시 시간 규칙 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 앱·서버 디렉터리 구조 |
| [SIGNAL-PRD.md](./SIGNAL-PRD.md) | 제품 방향·화면 역할 |
| [SERVER.md](./SERVER.md) | Signal Server·DB·Job 운영 |
| [NOTIFICATION-INBOX.md](./NOTIFICATION-INBOX.md) | 알림센터 서버·앱 계약 |
| [NEWS-ISSUE-AUTOMATION.md](./NEWS-ISSUE-AUTOMATION.md) | 뉴스 이슈 ingest JSON |
| [DISCLOSURE-DIGEST-AUTOMATION.md](./DISCLOSURE-DIGEST-AUTOMATION.md) | 공시 다이제스트 ingest JSON (외부 에이전트, Admin Job 아님) |
| [DIGEST-SOURCE-REF-HYDRATION.md](./DIGEST-SOURCE-REF-HYDRATION.md) | 다이제스트 출처 참조키 조회·locale hydrate |
| [NEWS-TRANSLATION-AUTOMATION.md](./NEWS-TRANSLATION-AUTOMATION.md) | 뉴스 번역 pending·ingest JSON |
| [TODAY-BRIEFING-AUTOMATION.md](./TODAY-BRIEFING-AUTOMATION.md) | 오늘의 브리핑 ingest |
| [MARKET-BRIEFING-AUTOMATION.md](./MARKET-BRIEFING-AUTOMATION.md) | 시장 브리핑 ingest |
| [ETF-INSIGHT-AUTOMATION.md](./ETF-INSIGHT-AUTOMATION.md) | ETF 브리핑 ingest·홈 노출 |
| [EXPO-EAS-OPERATIONS.md](./EXPO-EAS-OPERATIONS.md) | Expo/EAS·Xcode 빌드 |
| [SOCIAL-AUTH.md](./SOCIAL-AUTH.md) | 소셜 로그인·JWT |
| [SIGNAL-ADMIN-UIUX.md](./SIGNAL-ADMIN-UIUX.md) | Admin UI 기준 |
| [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) | 출시 전 점검 |
| [TODO.md](./TODO.md) | 후속 과제 |
| [XCODE-EXTERNAL-DRIVE.md](./XCODE-EXTERNAL-DRIVE.md) | (선택) Xcode 캐시 외장 디스크 |

## 원칙

- 앱은 Signal Server만 호출한다. 외부 provider 키와 호출은 서버/Admin에서 관리한다.
- 앱 피처 데이터 HTTP는 `integrations/signal-api/`에 둔다.
- 화면은 `app/`, 공용 UI는 `components/`, 제품 규칙은 `domain/`, 로컬 설정과 세션은 `services/`에 둔다.
- 서버는 `server/src/http/`, `server/src/db/`, `server/src/jobs/`, `server/src/providers/` 기준으로 나눈다.
- 문서는 **현재 기준만** 유지한다. 변경 이력·과거 안은 남기지 않는다.
- UI 작업 전 [DESIGN-GUIDE.md](./DESIGN-GUIDE.md), 코드·연동 작업 전 [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md)를 본다.
- **다른 앱에 동일 UI 기준을 적용**할 때는 [APP-UI-PLAYBOOK.md](./APP-UI-PLAYBOOK.md)를 체크리스트로 쓴다.
- **날짜·시간**은 [DATE-TIME.md](./DATE-TIME.md)를 따른다. 서버는 UTC, 앱 API는 UTC ISO, 표시는 로케일·기기 타임존.
- **화면 레이아웃·여백**은 [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md)와 `constants/screenLayout.ts`를 따른다.
- **PTR·chip·폴링·피드 캐시 상호작용**은 [FEED-INTERACTION.md](./FEED-INTERACTION.md)를 따른다.
- **종목 로고**는 앱 에셋으로 두지 않는다. 주식=Parqet CDN, 코인=`/v1/coins` `imageUrl`(CoinGecko). [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md) · [SERVER.md](./SERVER.md).

## 피드 API 캐시

리스트·피드 화면의 HTTP 호출은 `integrations/signal-api/` 메모리 캐시(TTL)를 공통으로 쓴다.

- **기본** `cacheMode: 'use'` (`signalCacheMode()`): 필터·탭 전환·재진입. 캐시 hit이면 네트워크 없이 즉시 표시.
- **새로고침** `cacheMode: 'bypass'` (`signalCacheMode(true)`): 당겨서 새로고침만 네트워크 강제.
- **폴링·배지** (`newsUnreadPreference`, `disclosureUnreadPreference`, `signalUnreadPreference`, `alertsUnreadPreference`): 최신 id 확인만 `bypass`.
- 화면마다 `listCacheRef`·`peekQuotes` 등 **중복 캐시를 두지 않는다** — API 레이어(`integrations/signal-api/cache/`)에 위임.
- 필터(세그먼트·날짜 등)는 **각각 별도 API 호출**로 가져오고, 재선택·재진입은 `signalCacheMode()` 캐시 hit으로 즉시 표시한다. 뉴스·공시 탭의 All/속보/출처·시장·공시유형 칩 필터는 제거했다.

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
| `etfInsightsCache` | ETF 브리핑 | 2분 |
| `marketCache` | 시세·코인·마켓 리스트 | 5분 / 10분(리스트) |
| `calendarCache` | 캘린더 | 15분 |

설정에서 **캐시 삭제** 시 `clearSignalApiCache()`가 위 모듈을 모두 비운다.

## Pull-to-refresh · chip · 폴링

피드·리스트 상호작용 전체 규칙: **[FEED-INTERACTION.md](./FEED-INTERACTION.md)**

요약:

- PTR·헤더 탭: `onRefreshBase` → `signalCacheMode(true)`, **스크롤 위치 유지**
- 필터·탭·날짜 변경: `useScrollToTopOnChange` (PTR과 분리)
- 새 소식 chip: 리스트 위 strip, **scope별** state, 폴링은 chip만 (자동 fetch 금지)
- digest: `topFixed`, PTR/chip과 동시 `bypass` 갱신. 가로 스크롤은 `WebHorizontalScrollStrip` 자유 스크롤 — [FEED-INTERACTION.md §5](./FEED-INTERACTION.md#5-고정-digest)

## 실행

```bash
npm install
npm run start
npm run ios
npm run android
npm run web
npm run server:dev
npm run verify   # tsc + domain unit tests (CI)
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
| 홈 | `app/(tabs)/home.tsx`, `components/signal/HomeFocusContent.tsx` |
| 홈 바로가기 | `components/signal/HomeShortcutsStrip.tsx`, `constants/homeShortcuts.ts`, `domain/home/shortcutDisplay.ts` |
| 시장 | `app/(tabs)/signal.tsx`, `components/signal/MarketBriefingBlock.tsx` |
| 뉴스 | `app/(tabs)/news.tsx`, `components/news/LegacyNewsFeedScreen.tsx`, `components/signal/NewsCard.tsx` |
| 공시 | `app/(tabs)/disclosures.tsx` |
| 게시판 | `app/(tabs)/board.tsx`, `app/more-board.tsx`, `components/community/BoardContent.tsx` |
| 시세 | `app/(tabs)/quotes.tsx` |
| 더보기 | `app/(tabs)/more.tsx` |
| 게임센터 | `app/game-center.tsx`, `app/games/sum-trail.tsx`, `domain/games/sumTrail/` |
| 유튜브 | `app/(tabs)/youtube.tsx` |
| 캘린더 | `app/calendar.tsx`, `components/signal/InvestMonthCalendar.tsx` |
| 알림함 | [NOTIFICATION-INBOX.md](./NOTIFICATION-INBOX.md), `app/alerts.tsx` |
| 마감 브리핑 상세 | `app/today-briefing.tsx` |
| 뉴스·공시 다이제스트 상세 | `app/news-digest.tsx` · `app/disclosure-digest.tsx` |
| 설정 | `app/settings.tsx`, `constants/settingsTabs.ts` |
| 계정 | `app/account.tsx`, `services/appAuthSession.ts` |
| 피드 UX | [FEED-INTERACTION.md](./FEED-INTERACTION.md) |
| 뉴스 이슈 자동화 | [NEWS-ISSUE-AUTOMATION.md](./NEWS-ISSUE-AUTOMATION.md) |
| 마감 브리핑 자동화 | [TODAY-BRIEFING-AUTOMATION.md](./TODAY-BRIEFING-AUTOMATION.md) |
| Signal API | `integrations/signal-api/` |
| Admin | `server/src/public/admin/` |
| DB | `server/src/db/` |
| Job | `server/src/jobs/`, `server/src/worker.mjs` |
| 날짜·시간 | [DATE-TIME.md](./DATE-TIME.md), `utils/date.ts`, `server/src/time/utc.mjs` |
