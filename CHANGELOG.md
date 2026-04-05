# SIGNAL — 변경 요약 (기능 위주)

## 2026-04-04

### UI: 플로팅 탭바 · 시그널 로딩 (커밋 `c48e2d0`)

- 플로팅·둥근 탭바, 웹 `backdrop-filter`·호버, 탭 화면 하단 패딩/FAB 정렬.
- 시세: 세그먼트 전환 시 로딩, 로더를 헤더·세그 아래 가운데.
- 컨콜: 상단(제목·힌트·쿼리 요약) 유지 후 아래 영역에 로딩.

#### 파일별

| 파일 | 변경 내용 |
|------|-----------|
| `constants/tabBar.ts` | 플로팅 좌우·하단 여백, 캡슐 반경 등 상수 |
| `app/(tabs)/_layout.tsx` | 탭바 블러·틴트·플로팅 위치·그림자, 웹 반투명 glass |
| `components/SlackTabBarButton.tsx` | 웹 `hoverEffect`; 선택 탭 둥근 필 배경 제거 |
| `app/(tabs)/youtube.tsx` | 스크롤·FAB 하단 여백을 플로팅 탭바에 맞춤 |
| `app/(tabs)/quotes.tsx` | `SignalLoadingIndicator`, 세그먼트 전환 로딩, 중앙 로더 레이아웃 |
| `app/(tabs)/calls.tsx` | 상단 고정 블록 + 하단 로딩/스크롤 분리, 패딩 |
| `components/signal/SignalLoadingIndicator.tsx` | **신규** — 헤더와 동일 막대 로고 애니메이션 로더 |

### 뉴스 탭: 글로벌 / 코인 / 한국 세그먼트

- **글로벌**: Finnhub `category=general`.
- **코인**: Finnhub `category=crypto`.
- **한국**: Finnhub에 한국 전용 카테고리 없음 → `general`+`forex` 풀을 합친 뒤 `services/newsKoreaFilter.ts`에서 키워드로 한국 관련만 표시. 전용 한국 뉴스 API를 붙이면 이 필터를 대체 가능.
- 마지막 선택 세그먼트는 `services/newsSegmentPreference.ts`에 저장.

#### 파일별

| 파일 | 변경 내용 |
|------|-----------|
| `constants/newsSegment.ts` | **신규** — 세그먼트 키·기본값 |
| `services/finnhub.ts` | `fetchMarketNews`, `mergeNewsById`, `FinnhubMarketNewsCategory` |
| `services/newsKoreaFilter.ts` | **신규** — 한국 관련 키워드 필터 |
| `services/newsSegmentPreference.ts` | **신규** — AsyncStorage에 세그먼트 저장 |
| `app/(tabs)/index.tsx` | 상단 세그먼트 UI, 분기 로드 |
| `locales/messages.ts` | 세그먼트 라벨·힌트·한국 빈 상태 문구 |

---

### 시세 · 설정

- **탭 순서(순서)**: `react-native-draggable-flatlist`로 드래그 정렬(핸들: RNGH `Pressable`). 루트에 `GestureHandlerRootView`.
- **섹션**: 키커를 **순서** / **개수**로 단순화; **순서** 블록을 **개수** 위로 배치.
- **목록 개수**: 인기·시총·코인 모두 10~100(10단위) 동일 선택. 시총 탭 표시용 **`MCAP_SCREEN_UNIVERSE` 대폭 확장**, Finnhub `profile2`는 청크 단위 호출.
- **캐시** (`services/quotesCache.ts`): 시세 quote 메모리 캐시 TTL을 **갱신 주기(30초)와 동일**하게 통일(`QUOTES_POLL_INTERVAL_MS`). **시총순 심볼 순서**는 별도 TTL(10분)으로 캐시해 profile2 반복 부담 완화; 새로고침 시 순서 재계산. 설정의 캐시 한 줄에서 시세는 **초 단위** 표기.
- **저장**: 탭 순서(`quotesSegmentOrderPreference`), 목록 상한(`quotesListLimitsPreference`).

### 캘린더

- **투자 캘린더 UI** 보강(`InvestMonthCalendar.tsx` 등), **캘린더 메모리 캐시**(`calendarCache.ts`) 및 표시 설정의 캐시 스위치·연동.

### 유튜브 · 기타

- 유튜브 탭 일부 정리. **세그먼트 탭 스타일** 상수 분리(`constants/segmentTabBar.ts`).

### 의존성

- `react-native-draggable-flatlist`, `react-native-gesture-handler` 등.

### 문서

- **에이전트·도구 공통 온보딩**: 저장소 루트 `AGENTS.md` (구조, env, 명령, 수정 위치). 이후 구조·환경 변경 시 함께 갱신.

---

## 최근 커밋 기준

### 캘린더 · 컨콜 · 메가캡

- **메가캡 유니버스**: 실적/컨콜 후보에 쓰는 미국 대형주 티커 큐레이션 (`constants/megaCapUniverse.ts`).
- **캘린더·컨콜 스코프**: 설정에서 실적 행을 **메가캡** 기준으로 볼지, **관심종목** 기준으로 볼지 선택 (저장).
- **컨콜 필터**: 회계연도·분기 조회 모달, 필터에 맞춰 요약 후보 구성.
- **컨콜 메모리 캐시**: 동일 필터 조합에 대해 TTL 동안 재요청 완화; **당겨서 새로고침**은 캐시 무시 후 재조회.
- **메가캡 티커 목록 화면**: 설정(표시)에서 정보용으로 전체 티커 목록 확인.

### 캐시 · 설정

- **유튜브 / 컨콜 캐시 스위치**: 각각 켜고 끄기(저장). 끄면 해당 화면은 매번 네트워크·요약 경로로 로드.
- **캐시 비우기**: 유튜브·컨콜 메모리 캐시 일괄 삭제.
- **표시 탭**: 캐시 안내 한 줄(TTL 분) + 짧은 라벨로 UI 정리.

### 유튜브

- 정렬·채널 선택 기준 **메모리 캐시**(TTL); 설정의 캐시 off 시 미사용.

### 뉴스 · 시세 · UI

- 뉴스 속보/제공사 필터 등 피드 관련 보강.
- 시세(암호화폐 등) 연동 관련 서비스 추가.
- 탭바/헤더·광고(AdMob) 네이티브·웹 분리 등 클라이언트 구조 정리.

### 인프라

- **OTA/업데이트 배너** 컨텍스트 및 관련 유틸.
- `app.config.js` 등 Expo 설정 보강.
- 로케일(ko/en/ja) 문자열 확장.

---

이후 변경도 이 파일에 누적하거나, 버전 섹션을 나누어 적어도 됩니다.

**온보딩:** Claude·Cursor 등 도구용 참고는 **`AGENTS.md`**.

### iOS 실기기 즉시 종료 완화

- **`babel.config.js`**: `babel-preset-expo` + `react-native-reanimated/plugin` (마지막).
- `NotificationListener`: `setNotificationHandler`를 **`try/catch`**.
- **New Architecture**: Reanimated 4.x 요구로 `app.json` / `ios/Podfile.properties.json`에서 **`newArchEnabled` true** 유지. 끄면 `pod install` 실패 가능.
- 적용 후 **iOS 앱 재빌드** 필요.
