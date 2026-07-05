# 화면 레이아웃 기준

앱 화면의 Safe Area, 헤더, 여백, 스크롤 하단 패딩은 **`constants/screenLayout.ts`** 와 이 문서를 기준으로 맞춘다.

구현 상수·헬퍼는 코드가 단일 출처(source of truth)이며, 이 문서는 규칙과 패턴을 설명한다.

## 반응형 모드

`useResponsiveLayout()` (`hooks/useResponsiveLayout.ts`):

| 모드 | 조건 | `useTwoPane` |
|---|---|---|
| compact | 너비 < 768 | false |
| regular | 768 ≤ 너비 < 900 | false |
| wide | iPad 또는 웹, 너비 ≥ 900 | true |

- **iPhone**: compact / regular — 하단 플로팅 탭바, 탭마다 `SignalHeader compact`.
- **iPad·넓은 웹**: wide — 좌측 `SignalSidebarTabBar`, 상단 `SignalHeader`는 `(tabs)/_layout` 한 곳, 탭 화면은 `useTwoPane`일 때 헤더·탭바 중복 금지.

콘텐츠 최대 폭: `APP_CONTENT_MAX_WIDTH` (720), wide는 `APP_WIDE_CONTENT_MAX_WIDTH` (1120).  
가로 inset: `APP_CONTENT_SIDE_PADDING` (16).

## Safe Area `edges`

| 화면 유형 | iPhone | iPad / wide |
|---|---|---|
| 탭 화면 | `['top']` | `[]` (부모 `IpadWideTabLayout`이 top 처리) |
| 스택 화면 | `['bottom']` (Expo Stack 헤더가 top) | `IpadSidebarScreen` 또는 임베디드 pane |
| 설정 | `[]` | 임베디드 / `IpadSidebarScreen` |

예외는 코드 주석과 함께만 허용한다.

## 세로 여백 (공통 상수)

| 상수 | px | 용도 |
|---|---:|---|
| `SCREEN_HEADER_CONTENT_GAP` | 10 | `SignalHeader` 아래 → 날짜 바·세그먼트 등 **첫 고정 UI** |
| `SCREEN_FIXED_HEADER_PADDING_TOP` | 10 | `topFixed` 블록 상단 (=`HEADER_CONTENT_GAP`) |
| `SCREEN_FIXED_HEADER_PADDING_BOTTOM` | 12 | `topFixed` 블록 하단 |
| `SCREEN_LIST_CONTENT_PADDING_TOP` | 8 | 고정 UI 아래 **스크롤 리스트** 상단 |
| `SCREEN_WIDE_CONTENT_PADDING_TOP` | 12 | wide 2-pane 본문 컬럼 상단 |
| `SCREEN_EMBEDDED_WIDE_PADDING_TOP` | 16 | 사이드바 임베디드 스택 본문 상단 |
| `SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL` | 20 | 사이드바 임베디드 스택 가로 |

### 레이어 구조 (iPhone 탭)

```
SafeAreaView edges={['top']}
  SignalHeader compact
  [OtaUpdateBanner]
  topFixed | dateNavigatorWrap     ← SCREEN_HEADER_CONTENT_GAP / FIXED_HEADER_*
    세그먼트 · 날짜 바 · 배너
  ScrollView / FlatList            ← SCREEN_LIST_CONTENT_PADDING_TOP
  FloatingGlassFab (선택)
  SignalFloatingTabBar (layout)
```

- **`topFixed` 패턴**: 뉴스·시세·공시·유튜브·게시판 — 세그먼트를 스크롤 밖에 고정.
- **날짜 바 패턴**: 홈·시장·뉴스 이슈·공시 흐름 — `SignalDateNavigator`를 스크롤 위 또는 내부 첫 행으로 배치. 헤더 직후면 `marginTop: SCREEN_HEADER_CONTENT_GAP`.

## 하단 스크롤 패딩

| 상수 | px | 용도 |
|---|---:|---|
| `SCREEN_TAB_SCROLL_BOTTOM_BASE` | 24 | iPhone 탭 + 플로팅 탭바 |
| `SCREEN_STACK_SCROLL_BOTTOM_BASE` | 28 | 스택 화면 |
| `SCREEN_WIDE_SCROLL_BOTTOM_BASE` | 32 | iPad·wide (탭바 없음) |
| `SCREEN_FAB_ABOVE_TAB_OFFSET` | 8 | FAB lift |

### 헬퍼 (직접 숫자 합산 지양)

```ts
import {
  fabStackBottom,
  stackScreenScrollBottomPadding,
  tabScreenScrollBottomPadding,
} from '@/constants/screenLayout';

// 탭 화면 FlatList / ScrollView
paddingBottom: tabScreenScrollBottomPadding(tabBarHeight, insets.bottom);

// 스택 화면
paddingBottom: stackScreenScrollBottomPadding(insets.bottom);

// wide 탭 / iPad 홈
paddingBottom: SCREEN_WIDE_SCROLL_BOTTOM_BASE;

// FAB
bottom: fabStackBottom(tabBarHeight, insets.bottom);
```

`tabBarHeight`는 `useBottomTabBarHeight()`, inset은 `useSafeAreaInsets().bottom`.

## 플랫폼별 차이

| 항목 | iPhone | iPad / wide web |
|---|---|---|
| 상단 헤더 | 탭마다 `SignalHeader` | `_layout` 전역 1회 |
| 세그먼트 | `topFixed` 또는 화면 내 | `SidebarSubTabsContext`로 사이드바 |
| 콘텐츠 폭 | max 720 중앙 | pane 전체 또는 max 1120 |
| 하단 | 탭바 + inset 헬퍼 | `SCREEN_WIDE_SCROLL_BOTTOM_BASE` |
| 가로 pad | 16 | 탭 pane: 16 또는 0(`wideContentFill`); 임베디드 스택: 20 |

웹은 iPad와 동일 breakpoint(900px)를 쓰고, 스크롤 viewport는 `constants/webLayout.ts`의 `webScrollViewportStyle`을 따른다.

## 재사용 레이아웃 컴포넌트

| 컴포넌트 | 용도 |
|---|---|
| `IpadSidebarScreen` | wide 스택 — 헤더 + 사이드바 + 뒤로가기 |
| `MasterDetailLayout` | 시세·공시 2-pane |
| `IpadHomeScreen` | wide 홈 |
| `WebWheelScrollView` / `WebWheelFlatList` | 웹 휠 스크롤 |

**wide 2-pane 주의:** `SCREEN_WIDE_CONTENT_PADDING_TOP`은 **행(`wideBody`) 또는 리스트(`listContentWide`) 중 한 곳에만** 적용한다. 둘 다 더하면 왼쪽 리스트 상단이 과하게 벌어진다. `ListHeaderComponent`는 wide에서 `paddingTop: 0`(`listHeaderWide`)으로 두고, 행 padding만 쓴다.

새 화면은 위 패턴 중 하나를 선택하고, 여백은 `screenLayout` 상수만 사용한다.

## 새 화면 체크리스트

1. `useResponsiveLayout()` → `useTwoPane` 분기
2. Safe Area `edges` 표준 적용
3. iPhone만 `SignalHeader compact` (wide는 중복 금지)
4. 고정 UI 있으면 `topFixed` + `SCREEN_FIXED_HEADER_*`
5. 리스트 `paddingTop`: `SCREEN_LIST_CONTENT_PADDING_TOP`
6. 하단: `tabScreenScrollBottomPadding` / `stackScreenScrollBottomPadding` / `SCREEN_WIDE_SCROLL_BOTTOM_BASE`
7. 가로: `APP_CONTENT_SIDE_PADDING` (리터럴 `16` 지양)
8. FAB: `fabStackBottom`

## 관련 파일

- `constants/screenLayout.ts` — 여백 상수·헬퍼
- `constants/responsiveLayout.ts` — 폭·breakpoint
- `constants/segmentTabBar.ts` — 세그먼트 pill 스타일 (`getSegmentTabBarStyles`) + screenLayout re-export
- `constants/webLayout.ts` — 웹 flex/scroll
- `constants/tabBar.ts` — 탭바 치수·inset
- `components/signal/SignalHeader.tsx`
- `app/(tabs)/_layout.tsx` — wide 탭 셸
