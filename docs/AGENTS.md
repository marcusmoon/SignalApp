# SIGNAL — 에이전트·도구 공통 참고서

저장소를 다룰 때 **먼저 읽을 단일 온보딩 문서**입니다. 제품 요약은 **[SIGNAL-PRD.md](./SIGNAL-PRD.md)** , 변경 이력은 **[CHANGELOG.md](./CHANGELOG.md)** , 레이어 구분은 **[ARCHITECTURE.md](./ARCHITECTURE.md)** 입니다.

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
```

`postinstall`에 **patch-package** — `patches/` 변경 후 재설치.

## 3. 환경 변수 (`EXPO_PUBLIC_*`)

`.env` / `.env.local`, Metro 재시작 후 반영. 런타임은 **`services/env.ts`** 의 `env`.

| 변수 | 용도 |
|------|------|
| `EXPO_PUBLIC_FINNHUB_TOKEN` | 시세·뉴스·캘린더 (없으면 Finnhub 비활성) |
| `EXPO_PUBLIC_ANTHROPIC_API_KEY` | Claude |
| `EXPO_PUBLIC_OPENAI_API_KEY` | OpenAI(요약·번역 등) |
| `EXPO_PUBLIC_YOUTUBE_API_KEY` | YouTube Data API |
| `EXPO_PUBLIC_API_NINJAS_KEY` | API Ninjas 등 |
| `EXPO_PUBLIC_ADMOB_*_UNIT_ID` | AdMob (비우면 테스트 ID) |
| `EXPO_PUBLIC_PREVIEW_OTA_BANNER` | 개발용 OTA 배너 |

프로덕션 민감 키는 **BFF** 쪽이 안전.

### 외부 연동 — `integrations/<provider>/`

1. **`client.ts`** 만 아웃바운드 요청 + `services/env` 키 사용.  
2. **`types.ts`** (선택) DTO.  
3. **`index.ts`** / 캐시 — `client`만 호출; 이 레이어에서 `env` 직접 읽지 않음.  
4. **`services/<name>.ts`** — 필요 시 **re-export**만.

## 4. 디렉터리

```
app/           # expo-router (경로 = URL)
components/
constants/
contexts/
locales/       # ko 키 기준 → en, ja (satisfies)
integrations/  # 벤더별 HTTP/SDK
domain/        # 규칙만: news/*, concalls/*, youtube/*, quotes/*, theme/colorHex, calendar/*, moreHub/*
services/      # AsyncStorage·설정·오케스트레이션·re-export
utils/         # 날짜, 링크, openYoutube, …
docs/          # 본 문서·PRD·CHANGELOG·ARCHITECTURE
assets/
```

## 5. 자주 쓰는 연결

| 화면/기능 | 참고 |
|-----------|------|
| 시세 탭 | `app/(tabs)/quotes.tsx`, 순서 `quotesSegmentOrderPreference`, 캐시 `integrations/finnhub/quotesCache.ts` |
| 뉴스 탭 | `app/(tabs)/index.tsx`, 순서 `newsSegmentOrderPreference`, 한국 필터 `domain/news/koreaFilter.ts`, 추가 키워드 기본·정규화 `domain/news/koreaKeywords.ts`, 저장 `services/newsKoreaKeywordsPreference.ts`, LLM 있으면 **제목 번역** |
| 컨콜 | `domain/concalls/fiscal.ts` (연도·분기·범위), 저장 `services/concallFiscalFilter.ts`, 흐름 `services/concalls.ts` |
| 유튜브 검색 보조 | `domain/youtube/economy.ts`, 카드에서 열기 `utils/openYoutube.ts` |
| 설정 | `app/settings.tsx` — 뉴스·유튜브·시세·캘린더·표시·알림 |
| 테마·문자열 | `SignalThemeContext`, `locales/*` (`@/locales/messages`) |

**제스처:** 루트 `GestureHandlerRootView`. 시세/뉴스 세그먼트 순서 드래그는 `react-native-draggable-flatlist` 등.

## 6. `services/` vs `integrations/`

Finnhub·YouTube·Anthropic·OpenAI·컨콜 캐시·AdMob 본체는 **`integrations/`**; **`services/`** 는 위 모듈 re-export, `env`, 관심종목·알림·OTA 등 **기기/조합** 담당.

## 7. 코딩 메모

- 요청 범위 밖 대규모 리팩터·불필요한 마크다운 추가 자제. **예외:** `docs/AGENTS.md`, `docs/CHANGELOG.md`, `docs/SIGNAL-PRD.md`.
- 새 문자열은 **`locales/ko.ts`** 에 먼저, en/ja 동일 키.
- 커밋 전 **`docs/CHANGELOG.md`** 에 이번 변경을 **날짜 아래** 짧게 남긴다(대형 작업이면 파일별 표, 소규모면 한 블록 요약으로 충분).

## 8. 문서 갱신 체크리스트

| 바꾼 것 | 같이 볼 문서 |
|---------|----------------|
| 라우트·탭·큰 폴더 | `docs/AGENTS.md` §4~5, `docs/ARCHITECTURE.md` |
| `EXPO_PUBLIC_*` | §3, `services/env.ts` 주석 |
| 제품 범위 | `docs/SIGNAL-PRD.md` |
| 눈에 띄는 동작 변경 | `docs/CHANGELOG.md` |

## 9. iOS 크래시 시

- Reanimated 4.x → **New Architecture** on (`app.json` / `ios/Podfile.properties.json`).  
- Pods 동기화: `cd ios && pod install`.  
- Babel: `react-native-reanimated/plugin` **마지막**.  
- 알림: `NotificationListener.tsx` 의 handler 초기화 실패 대비.  
- 스택: Xcode → Devices → Device Logs.

*버전 번호는 `package.json`의 expo/react-native가 단일 출처.*
