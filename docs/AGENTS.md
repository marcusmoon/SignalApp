# SIGNAL — 에이전트·도구 공통 참고서

저장소를 다룰 때 **먼저 읽을 단일 온보딩 문서**입니다. 제품 요약은 **[SIGNAL-PRD.md](./SIGNAL-PRD.md)** , 현재 운영 스냅샷은 **[CHANGELOG.md](./CHANGELOG.md)** , 레이어 구분은 **[ARCHITECTURE.md](./ARCHITECTURE.md)** , 서버·스케줄러 실행은 **[SERVER.md](./SERVER.md)** 입니다.

## 1. 한줄 요약

| 항목 | 내용 |
|------|------|
| 이름 | SIGNAL (`package.json`: `signal`) |
| 스택 | **Expo SDK 54** · **RN 0.81** · **expo-router** |
| 언어 | TypeScript `strict`, 경로 별칭 `@/*` → 루트 |

## 2. 실행

```bash
cd SignalApp
npm install
npx expo start          # 개발 서버 (--web 가능)
npx expo run:ios
npx expo run:android
npx tsc --noEmit        # 타입 검사
npm run server:dev      # 로컬 Signal API + 어드민 + 스케줄러
```

`postinstall`에 **patch-package** — `patches/` 변경 후 재설치.

## 3. 환경 변수 (`EXPO_PUBLIC_*`)

`.env` / `.env.local`, Metro 재시작 후 반영. 런타임은 **`services/env.ts`** 의 `env`.

| 변수 | 용도 |
|------|------|
| `EXPO_PUBLIC_SIGNAL_API_BASE_URL` | Signal API 서버 도메인 (예: 로컬 `http://127.0.0.1:4000`) |
| `EXPO_PUBLIC_ADMOB_*_UNIT_ID` | AdMob (비우면 테스트 ID) |
| `EXPO_PUBLIC_PREVIEW_OTA_BANNER` | 개발용 OTA 배너 |

앱은 피처 데이터를 **Signal Server만** 통해 조회합니다. Finnhub/OpenAI/Claude/YouTube/CoinGecko 등 외부 provider 키는 서버/Admin에서 관리합니다.

### 외부 연동

1. 앱 피처 조회는 **`integrations/signal-api/`** 에서만 HTTP를 수행합니다.
2. 제품 시드·규칙은 **`domain/<영역>/`** 에 두고, API 응답 형태는 **`integrations/signal-api/types`** 등으로 맞춥니다.
3. 신규 화면·서비스는 Finnhub·YouTube Data·LLM·CoinGecko·Ninjas 등 **외부 provider 클라이언트를 앱에 두지 않습니다**(서버·Admin이 키와 수집을 담당).

## 4. 디렉터리

```
app/           # expo-router (경로 = URL)
components/
hooks/         # 공용 훅 + `index.ts` 배럴 (`@/hooks`). Context 전용은 `contexts/`
constants/     # 앱 전역 정적 값(테마·탭 UI·newsSegment 등). 영역 시드·순서는 `domain/*/constants.ts`
contexts/
locales/       # ko 키 기준 → en, ja (satisfies)
integrations/  # Signal API(+cache), AdMob, expo-updates
domain/        # 규칙만: 영역별 `constants.ts`(시드)·모듈 + `index.ts` 배럴(`@/domain/news` 등)
services/      # AsyncStorage·설정·오케스트레이션, `services/cache/`(탭·TTL·캐시 클리어 보조)
utils/         # 날짜, 링크, openYoutube, …
docs/          # 본 문서·PRD·(운영 스냅샷)·ARCHITECTURE
assets/
```

## 5. 자주 쓰는 연결

| 화면/기능 | 참고 |
|-----------|------|
| 시세 탭 | `app/(tabs)/quotes.tsx`, 순서 `quotesSegmentOrderPreference`, Signal API 시세·코인, 보조 캐시 `services/cache/quotesCache.ts` |
| 뉴스 탭 | `app/(tabs)/index.tsx`, 순서 `newsSegmentOrderPreference`, `@/domain/news`, `components/signal/NewsCard`, 해시태그 표시 설정 `services/newsHashtagDisplayPreference.ts`, `fetchSignalNews` / `integrations/signal-api/cache/newsCache`, 저장 `services/newsKoreaKeywordsPreference.ts` |
| 컨콜 | `@/domain/concalls`(연도·분기·범위·실적 행), 저장 `services/concallFiscalFilter.ts`, 서버 API `integrations/signal-api/concalls.ts`, 흐름 `services/concalls.ts` |
| 유튜브 검색 보조 | `@/domain/youtube`, 카드에서 열기 `utils/openYoutube.ts` |
| 설정 | `app/settings.tsx` — 뉴스·유튜브·시세·캘린더·표시·알림, Signal 서버 endpoint 오버라이드 `services/signalServerEndpoint.ts` |
| 테마·문자열 | `SignalThemeContext`, `locales/*` (`@/locales/messages`) |
| OTA 배너 | `contexts/OtaBannerContext.tsx`, `integrations/expo-updates/`, 미리보기 플래그 `services/env` (`EXPO_PUBLIC_PREVIEW_OTA_BANNER`) |

**제스처:** 루트 `GestureHandlerRootView`. 시세/뉴스 세그먼트 순서 드래그는 `react-native-draggable-flatlist` 등.

## 6. `services/` vs `integrations/`

Signal API HTTP와 그 응답 메모리 캐시는 **`integrations/signal-api/`**, AdMob·OTA 어댑터는 각 integration에 둡니다. Finnhub·YouTube·OpenAI·Claude·CoinGecko·Ninjas 등 외부 provider HTTP는 서버가 담당하고, 앱은 `@/integrations/signal-api/...`만 호출합니다. **`services/`** 는 `env`, Signal 서버 endpoint 선택, 관심종목·알림·**캐시 on/off**(`cacheFeaturePreferences`) 등 **기기·설정·오케스트레이션**을 담당합니다.

## 7. 코딩 메모

- 요청 범위 밖 대규모 리팩터·불필요한 마크다운 추가 자제. **예외:** `docs/AGENTS.md`, `docs/CHANGELOG.md`, `docs/SIGNAL-PRD.md`, `docs/ARCHITECTURE.md`(레이어·상수 규칙 변경 시).
- 새 문자열은 **`locales/ko.ts`** 에 먼저, en/ja 동일 키.
- `docs/CHANGELOG.md`는 날짜별 기록을 쌓지 않고 **현재 운영 기준 스냅샷**만 유지한다.

## 8. 문서 갱신 체크리스트

| 바꾼 것 | 같이 볼 문서 |
|---------|----------------|
| 라우트·탭·큰 폴더·레이어·상수 위치 | `docs/AGENTS.md` §4~5, **`docs/ARCHITECTURE.md`** |
| `EXPO_PUBLIC_*` | §3, `services/env.ts` 주석 |
| 제품 범위 | `docs/SIGNAL-PRD.md` |
| 눈에 띄는 동작 변경 | `docs/CHANGELOG.md` (현재 스냅샷 갱신) |

## 9. iOS 크래시 시

- Reanimated 4.x → **New Architecture** on (`app.json` / `ios/Podfile.properties.json`).  
- Pods 동기화: `cd ios && pod install`.  
- Babel: `react-native-reanimated/plugin` **마지막**.  
- 알림: `NotificationListener.tsx` 의 handler 초기화 실패 대비.  
- 스택: Xcode → Devices → Device Logs.

*버전 번호는 `package.json`의 expo/react-native가 단일 출처.*
