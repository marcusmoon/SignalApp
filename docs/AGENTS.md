# SIGNAL 에이전트 온보딩

## 원칙

- 앱은 Signal Server만 호출한다. 외부 provider 키와 호출은 서버/Admin에서 관리한다.
- 앱 피처 데이터 HTTP는 `integrations/signal-api/`에 둔다.
- 화면은 `app/`, 공용 UI는 `components/`, 제품 규칙은 `domain/`, 로컬 설정과 세션은 `services/`에 둔다.
- 서버는 `server/src/http/`, `server/src/db/`, `server/src/jobs/`, `server/src/providers/` 기준으로 나눈다.
- 문서는 현재 기준만 유지한다. 과거 이력은 남기지 않는다.
- **날짜·시간**은 [DATE-TIME.md](./DATE-TIME.md)를 따른다. 서버는 UTC, 앱 API는 UTC ISO, 표시는 로케일·기기 타임존.
- **화면 레이아웃·여백**은 [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md)와 `constants/screenLayout.ts`를 따른다.

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
