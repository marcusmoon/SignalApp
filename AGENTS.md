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
| `EXPO_PUBLIC_OPENAI_API_KEY` | ChatGPT 요약·뉴스 번역 등 |
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
- **뉴스 탭** (`app/(tabs)/index.tsx`): 상단 세그먼트 순서는 `loadNewsSegmentOrder()` → `newsSegmentOrderPreference.ts`(기본 `NEWS_SEGMENT_ORDER`). **글로벌 / 코인 / 한국** — Finnhub `general`·`crypto`, 한국은 `general`+`forex` 후 키워드 필터(`services/newsKoreaFilter.ts`). 뉴스 카드는 선택한 LLM 제공자(Claude/OpenAI)가 있으면 **한국어 번역 제목 + 3줄 요약**을 생성한다. **추가 키워드**는 설정의 「뉴스」탭 「한국 뉴스 키워드」에서 등록하며 `services/newsKoreaKeywordsPreference.ts`에 저장된다(내장 정규식과 OR). 저장 키가 없을 때(첫 실행) `DEFAULT_KOREA_NEWS_KEYWORDS`가 시드되며, 설정에서 `restoreKoreaNewsExtraKeywordsDefaults()`로 동일 목록을 다시 채울 수 있다. 한국 **전용 API**는 없어서 나중에 교체 가능.

---

## 9. 설정 화면

- 파일: `app/settings.tsx` (단일 파일에 탭·모달 다수)
- 상단 탭: **뉴스**(뉴스 탭 순서·한국 키워드) · 유튜브 · 시세 · 캘린더 · 표시 · 알림
- 뉴스·시세: 드래그로 세그먼트 순서(`newsSegmentOrderPreference` / `quotesSegmentOrderPreference`), 시세는 목록 개수 모달 등
- **표시:** 앱 메뉴(하단 탭바) 글래스 강도(1=가장 투명 … 5=가장 진함) — `tabBarGlassPreference.ts`, 단계별 수치는 `constants/tabBarGlass.ts`, 적용은 `app/(tabs)/_layout.tsx`의 `TabBarGlassBackground`

---

## 10. 의존성 특기사항

- `react-native-reanimated`, `react-native-gesture-handler`, `react-native-draggable-flatlist` — 뉴스·시세 세그먼트 순서 드래그 등에 사용
- `react-native-google-mobile-ads` — 네이티브 광고 (웹은 별도 처리)

---

## 11. 코딩 시 권장 원칙 (요약)

- 요청 범위 밖 **리팩터·문서 남발 금지**; 기존 스타일·import 패턴 유지.
- 사용자가 명시한 **마크다운**만 추가/수정 (불필요한 README 남발 방지). **예외:** 본 `AGENTS.md`·`CHANGELOG.md`·`SIGNAL-PRD.md`는 유지보수 대상.
- 문자열은 하드코딩보다 **`locales/messages.ts`**.
- 변경 후 가능하면 **`npx tsc --noEmit`**.

### 11.1 커밋 전 — 변경 내용을 파일별로 기록 (필수)

**`git commit` 하기 전에** 반드시 `CHANGELOG.md`를 갱신한다.

1. 작업일(또는 해당 날짜) 섹션을 쓰거나 기존 날짜 아래에 **하위 블록**을 추가한다.
2. **변경한 각 파일**마다 한 줄 요약을 적는다. 권장 형식: 해당 날짜 아래 `### 파일별` 제목 + 표(`파일` / `변경 내용`).
3. 커밋 해시를 알면 괄호에 적어두면 추적에 유리하다(선택).
4. 소스 파일 상단에 **동일 내용을 주석으로 반복하지 않는다.** 기록의 단일 출처는 **`CHANGELOG.md`**이다.

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
| **커밋 직전** | `CHANGELOG.md`에 **파일별** 변경 한 줄씩 기록 (§11.1) |

**에이전트/도구에게:** 위 표에 해당하는 작업을 마친 뒤, 한 번씩 이 파일과 `CHANGELOG.md`를 열어 **한 줄이라도** 반영할 점이 있으면 수정할 것. **커밋 전에는 §11.1을 먼저 수행할 것.**

---

## 13. 버전 정보 (참고)

- `package.json`의 `expo` / `react-native` 버전이 단일 출처.
- 상세 제품 로드맵은 PRD의 Phase를 따름.

---

## 14. 실기기 iOS에서 앱이 바로 종료될 때 (체크리스트)

| 조치 | 설명 |
|------|------|
| **New Architecture** | `react-native-reanimated` **4.x는 New Architecture 필수** (`RNReanimated.podspec`). `app.json`의 `newArchEnabled`와 `ios/Podfile.properties.json`의 `newArchEnabled`를 **둘 다 `true`**로 맞출 것. **끄면** `pod install` 단계에서 실패할 수 있음. |
| **CocoaPods** | `The sandbox is not in sync with the Podfile.lock` → `cd ios && pod install`. `Podfile.lock` / `Pods`가 없거나 오래되었을 때 발생. |
| **Babel** | 루트 `babel.config.js`에 `babel-preset-expo` + **`react-native-reanimated/plugin` (반드시 마지막)**. 변경 후 Metro/빌드 캐시 클리어 권장. |
| **알림** | `expo-notifications`의 `setNotificationHandler`는 모듈 로드 시점에 실패할 수 있어 `try/catch`로 감쌈 (`NotificationListener.tsx`). |
| **원인 확인** | Xcode → **Window → Devices and Simulators** → 기기 → **View Device Logs** 에서 크래시 스택 확인. |

---

*마지막으로 전체 맥락이 필요하면 `SIGNAL-PRD.md` → `CHANGELOG.md` → 본 문서 순으로 읽는 것을 권장합니다.*
