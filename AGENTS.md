# SIGNAL — 에이전트·도구 공통 참고서

Claude, Cursor, Codex, Windsurf 등 **어떤 코딩 도구**에서도 이 저장소를 다룰 때 먼저 읽을 **단일 온보딩 문서**입니다.  
제품 요구사항·비즈니스 맥락은 **`SIGNAL-PRD.md`**, 기능별 누적 변경 요약은 **`CHANGELOG.md`**를 봅니다.

---

## 1. 프로젝트 한줄

| 항목 | 내용 |
|------|------|
| 이름 | SIGNAL (`package.json` name: `signal`) |
| 슬로건 | 노이즈는 걸러내고, 진짜 시그널만 |
| 스택 | **Expo SDK 54** · **React Native 0.81** · **expo-router** (파일 기반 라우팅) |
| 언어 | TypeScript (`strict`) |
| 경로 별칭 | `@/*` → 저장소 루트 (`tsconfig.json`) |

---

## 2. 필수 문서 링크

| 문서 | 용도 |
|------|------|
| `SIGNAL-PRD.md` | 제품 범위, MVP 기능, UX·기술 스택 요약 |
| `CHANGELOG.md` | 날짜별 구현·동작 변경 요약 (기능 위주) |
| `AGENTS.md` | **본 문서** — 구조, 명령, 환경 변수, 수정 위치 |

---

## 3. 실행 · 빌드

```bash
cd SignalApp   # 이 저장소 루트
npm install
npx expo start           # 개발 서버
npx expo start --web     # 웹
npx expo run:ios         # 네이티브 iOS
npx expo run:android     # 네이티브 Android
```

품질 확인:

```bash
npx tsc --noEmit
```

`postinstall`에 **`patch-package`**가 있음 — `patches/` 수정 시 재설치로 패치 적용.

---

## 4. 환경 변수 (`EXPO_PUBLIC_*`)

`.env` / `.env.local`에 정의. Metro 재시작 후 반영.  
런타임 접근은 주로 `services/env.ts`의 `env` 객체.

| 변수 | 용도 |
|------|------|
| `EXPO_PUBLIC_FINNHUB_TOKEN` | 시세·캘린더 등 Finnhub (없으면 `hasFinnhub()` false) |
| `EXPO_PUBLIC_ANTHROPIC_API_KEY` | Claude 요약 등 |
| `EXPO_PUBLIC_YOUTUBE_API_KEY` | 유튜브 데이터 |
| `EXPO_PUBLIC_API_NINJAS_KEY` | API Ninjas 등 |
| `EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID` / `EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID` | AdMob (비우면 테스트 ID) |
| `EXPO_PUBLIC_PREVIEW_OTA_BANNER` | 개발용 OTA 미리보기 배너 (`app.config.js`에서 `.env` 우선 병합) |

**보안:** 프로덕션에서는 민감 키는 클라이언트에 두지 말고 BFF 권장 (PRD와 동일 방향).

---

## 5. 디렉터리 구조 (요약)

```
app/                    # expo-router 화면
  _layout.tsx           # 루트 레이아웃 (GestureHandlerRootView, 테마·로케일 등)
  (tabs)/               # 하단 탭 4개
    _layout.tsx         # 탭 바·아이콘
    index.tsx           # 뉴스(홈)
    youtube.tsx
    quotes.tsx          # 시세
    calls.tsx           # 컨콜
  calendar.tsx          # 투자 캘린더 (하단 탭 밖 별도 화면; 링크로 진입)
  settings.tsx          # 설정(서브 탭: 유튜브·시세·캘린더·표시·알림 등)
  mega-cap-list.tsx
  modal.tsx
components/             # UI 조각
constants/              # 테마, 탭바, 세그먼트 탭 스타일 등
contexts/               # SignalTheme, Locale, OtaBanner
locales/messages.ts     # ko / en / ja 문자열 (`MessageId`, `formatMessage`)
services/               # API·캐시·AsyncStorage 기본 설정
assets/
```

새 화면 추가 시 **`app/`** 아래 파일 경로가 곧 URL 경로.

---

## 6. 주요 `services/` 모듈

| 영역 | 파일 (예) |
|------|-----------|
| 환경 | `env.ts` |
| Finnhub | `finnhub.ts` (시세·프로필·캘린더 등), `MCAP_SCREEN_UNIVERSE` 시총 유니버스 |
| 시세 캐시 | `quotesCache.ts` — quote TTL, 시총 순서 캐시, `QUOTES_POLL_INTERVAL_MS` |
| 시세 설정 저장 | `quotesListLimitsPreference.ts`, `quotesSegmentOrderPreference.ts` |
| 유튜브 | `youtube.ts`, `youtubeCache.ts`, `youtubeCurationList.ts`, … |
| 컨콜 | `concalls.ts`, `concallCache.ts`, … |
| 캘린더 | `calendarCache.ts`, `calendarConcallScopePreference.ts` |
| 코인 시세 | `cryptoMarkets.ts` (CoinGecko 등) |
| 캐시 플래그 | `cacheFeaturePreferences.ts` (기능별 캐시 on/off) |
| 알림 | `notificationPreferences.ts`, `notificationHistory.ts` |
| 광고 | `admob.native.ts` / `admob.web.ts` |
| OTA | `otaUpdates.ts` |

---

## 7. UI · 테마 · i18n

- **테마:** `contexts/SignalThemeContext.tsx`, `constants/theme.ts`, 악센트 `services/accentPreference.ts`
- **로케일:** `contexts/LocaleContext.tsx`, 문자열 **`locales/messages.ts`** — 새 문구는 `ko`에 추가 후 `MessageId` 타입이 키를 추론
- **세그먼트 탭 공통 스타일:** `constants/segmentTabBar.ts` (설정·시세 등에서 재사용)

---

## 8. 시세 탭 — 구현 시 자주 쓰는 연결

- 화면: `app/(tabs)/quotes.tsx`
- 탭 순서(관심/인기/시총/코인): `loadQuotesSegmentOrder()` → `quotesSegmentOrderPreference.ts`
- 목록 개수: `loadQuotesListLimits()` → `quotesListLimitsPreference.ts`
- 시총순 심볼 정렬: `getSymbolsSortedByMarketCap()` (`finnhub.ts`), 유니버스·프로필 API 부하 고려
- 메모리 캐시: `quotesCache.ts` (quote TTL = `QUOTES_POLL_INTERVAL_MS` 30초, 시총 **순서**는 별도 TTL)
- **제스처:** 루트 `GestureHandlerRootView` (`app/_layout.tsx`). 시세 **탭 순서** 설정은 `react-native-draggable-flatlist` + RNGH `Pressable` (웹·네이티브 차이 있음)

---

## 9. 설정 화면

- 파일: `app/settings.tsx` (단일 파일에 탭·모달 다수)
- 시세 관련: 목록 개수 모달, 탭 순서 드래그 리스트 등

---

## 10. 의존성 특기사항

- `react-native-reanimated`, `react-native-gesture-handler`, `react-native-draggable-flatlist` — 시세 순서 드래그 등에 사용
- `react-native-google-mobile-ads` — 네이티브 광고 (웹은 별도 처리)

---

## 11. 코딩 시 권장 원칙 (요약)

- 요청 범위 밖 **리팩터·문서 남발 금지**; 기존 스타일·import 패턴 유지.
- 사용자가 명시한 **마크다운**만 추가/수정 (불필요한 README 남발 방지). **예외:** 본 `AGENTS.md`·`CHANGELOG.md`·`SIGNAL-PRD.md`는 유지보수 대상.
- 문자열은 하드코딩보다 **`locales/messages.ts`**.
- 변경 후 가능하면 **`npx tsc --noEmit`**.

---

## 12. 이 문서를 언제 고칠까 (유지보수 체크리스트)

다음을 바꿀 때 **같이** 업데이트하면 이후 도구가 헛걸음하지 않습니다.

| 변경 유형 | 갱신할 문서 |
|-----------|-------------|
| 새 탭·라우트·큰 폴더 구조 | `AGENTS.md` §5~6 |
| 새 `EXPO_PUBLIC_*` 또는 env 의미 변경 | `AGENTS.md` §4, 필요 시 `services/env.ts` 주석 |
| 시세/캐시/Finnhub 동작 방식 변경 | `AGENTS.md` §6·8, `CHANGELOG.md` |
| 제품 범위·MVP | `SIGNAL-PRD.md` |
| 기능 완료·릴리즈 단위 요약 | `CHANGELOG.md` |

**에이전트/도구에게:** 위 표에 해당하는 작업을 마친 뒤, 한 번씩 이 파일과 `CHANGELOG.md`를 열어 **한 줄이라도** 반영할 점이 있으면 수정할 것.

---

## 13. 버전 정보 (참고)

- `package.json`의 `expo` / `react-native` 버전이 단일 출처.
- 상세 제품 로드맵은 PRD의 Phase를 따름.

---

*마지막으로 전체 맥락이 필요하면 `SIGNAL-PRD.md` → `CHANGELOG.md` → 본 문서 순으로 읽는 것을 권장합니다.*
