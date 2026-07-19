# APP UI PLAYBOOK

다른 앱을 같은 기준으로 만들 때 쓰는 **제품 UI 운영 표준**이다.  
SIGNAL에서 검증한 패턴을 추상화했으므로, 새 프로젝트는 이 문서를 체크리스트로 두고 [DESIGN-GUIDE.md](./DESIGN-GUIDE.md) · [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md) · [FEED-INTERACTION.md](./FEED-INTERACTION.md)를 상세 구현으로 따른다.

---

## 1. 목표

| 목표 | 의미 |
|---|---|
| 한 화면 한 역할 | 첫 뷰포트에 통계·프로모·부가 메타를 쌓지 않는다 |
| 플랫폼별 셸 | iPhone = 하단 탭, wide(웹·iPad) = 좌측 사이드바 + 우측 pane |
| 고정 크롬 / 스크롤 본문 | 날짜·세그먼트·다이제스트는 스크롤 밖, 리스트만 스크롤 |
| 밀도는 상수로 | 여백·gap·radius는 토큰만 사용. 화면마다 `16` 하드코딩 금지 |
| 재사용 컴포넌트 우선 | 헤더·날짜 바·세그먼트·PTR·chip·외부 링크 그리드는 공통 구현 |

---

## 2. 레이아웃 분기

```
useResponsiveLayout()
  ├─ phone (좁은 폭)  → 탭바 + (필요 시) compact SignalHeader
  └─ useTwoPane       → WideWebShell: 사이드바 + 우측 pane
```

| 규칙 | phone | wide |
|---|---|---|
| 상단 브랜드 헤더 | 탭 루트만 `SignalHeader compact` | `WideWebShell` 전역 1회. 화면 안 중복 금지 |
| 하단 내비 | `SignalFloatingTabBar` | 없음 (사이드바) |
| 콘텐츠 폭 | 전폭 + 좌우 `APP_CONTENT_SIDE_PADDING` | **탭·피드·플로우 루트는 pane 전체 채움** (`wideContentFill`). 일부 임베디드 상세만 max-width(예: 1120) 중앙 |
| 드릴인 뒤로 | Stack / `signalDrillStackOptions` (`PhoneHeaderBackButton` + 제목) | `WideSubpaneHeader` (동일 chevron + 제목). 루트·직접 URL에는 없음 |
| Safe Area | 탭: 하단 제외 등 화면별 `edges` | wide: 셸이 처리. 화면 `edges={[]}` 기본 |

상세 수치·헬퍼: [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md).

---

## 3. 상단 고정 크롬 (`topFixed`)

스크롤과 분리하는 UI만 넣는다.

### 단일 스트립

- 배경 `theme.card` + 하단 hairline
- 스타일: `getScreenFixedHeaderStyles()` + `SCREEN_FIXED_HEADER_*`
- 내부 세로 gap: `COMFORT_TOP_FIXED_GAP` (12)

### 권장 스택 순서 (리스트형 화면)

시장 브리핑·뉴스 플로우·공시 플로우처럼 **날짜가 있는 피드**는 아래 순서를 기본으로 한다.

```
topFixed
  1. SignalDateNavigator   ← 날짜
  2. Segment control       ← 필터/세션 (있으면)
  (다이제스트가 있으면 별도 digest 슬롯 — 뉴스/공시 분리 스택 참고)
본문 FlatList / ScrollView
```

날짜를 본문 `ListHeaderComponent`에 넣지 않는다.

### 날짜 바 — C1 (필수)

`SignalDateNavigator`:

- **바깥 셸 1개만** — 보더 + `bgElevated`(또는 동등 elevated 면)
- 안쪽 ◀ / 날짜 / 오늘 / ▶ 는 **보더·배경·카드 없음** — Ionicons + 텍스트만
- 중첩 박스로 보이지 않게 한다

### 세그먼트

- `getSegmentTabBarStyles(theme, scaleFont)` — underline: 활성 하단 green 라인 + green 텍스트
- phone 상단 pill · 설정 서브탭 · 시장 세션 등 **동일 스타일**
- wide에서는 동일 필터를 사이드바 서브탭으로도 노출 가능 (`SidebarSubTabsContext` + URL 쿼리 동기화)

---

## 4. 탭 · 사이드바 아이콘

| 상태 | 아이콘 |
|---|---|
| 비선택 | Ionicons `*-outline` |
| 선택 | 동일 계열 filled (outline 제거) |

- 이모지·커스텀 PNG 혼용 금지 (브랜드 로고 등 예외만)
- 라벨은 짧게. 아이콘이 상태를 말하게 한다
- iPhone 탭바 · wide 사이드바 **같은 매핑**을 쓴다

---

## 5. 홈 · 요약 카드 밀도

홈(또는 대시보드 홈)은 **한 호흡으로 훑고**, 상세는 드릴인한다.

| 규칙 | 내용 |
|---|---|
| 섹션 제목 | 제목만. 섹션 아래 부제(subtitle) 넣지 않음 |
| 시황/브리핑 카드 | 헤드라인 + 본문 **최대 2줄**(ellipsis). 전문은 상세 화면. 본문 뷰잉 시 `+1.2%`/`-0.5%`·`2.78% 상승`·근처 방향 힌트가 있는 `2.78%` 등 **변동률**을 설정 색(한/미)으로 강조 (점유·비중 등 비변동 `%` 제외) |
| 노출 개수 | 설정 → 표시에서 **스크롤 피커**로 조절 (시세 개수와 동일). 기본값을 화면에 하드코딩하지 말 것 |
| 상세 화면 | 말줄임 없이 전체 텍스트. 섹션당 한 목적 |
| 구분 | 행 구분선·여백으로 리듬. 카드 중첩 금지. **좌측 accent 세로 바 없음** |

---

## 6. 피드 · 리스트

| 항목 | 표준 |
|---|---|
| PTR | 공통 `ThemedRefreshControl` / 웹 wheel 스크롤 래퍼 |
| 새 소식 | 리스트 직전 chip (`FeedNewContentChip` 패턴). 플로팅 배지 남발 금지 |
| 그룹 카드 | grouped radius + `COMFORT_MARGIN_GROUP` |
| 다이제스트 가로 스트립 | 자유 스크롤, 페이지 스냅·dots 금지 |
| 출처 | 인라인 펼침 금지 → 시트/모달 |
| 필터 변경 | 스크롤 위치 리셋. 리스트 깜빡임 최소화(캐시 모드 통일) |

상호작용 상세: [FEED-INTERACTION.md](./FEED-INTERACTION.md).

---

## 7. Wide 내비 · URL

- 사이드바 클릭 = **루트 진입**. 드릴 스택이 있으면 비우고 해당 탭 루트로
- 홈 등 동일 탭 재클릭 레이스는 네비 컨텍스트에서 한 곳으로 수렴
- 드릴인 중에만 우측 pane 상단 `WideSubpaneHeader`(chevron → 직전 허브)
- 필터·날짜·서브탭은 **URL 쿼리에 기본값까지 명시**해 새로고침·공유가 깨지지 않게
- 서브메뉴 owner 단위 clear — 탭 전환 시 메뉴가 사라지지 않게

---

## 8. 웹 전용

| 항목 | 표준 |
|---|---|
| 세로 스크롤바 | 앱 스크롤 뷰포트에서 **숨김** (휠·트랙패드로만 스크롤). `data-signal-scroll-viewport` 등 마커 + 글로벌 CSS |
| 스크롤 컨테이너 | `WebWheelFlatList` / `WebWheelScrollView` — native와 동일한 고정 헤더 + 본문 분리 |
| 새로고침 | 라우트·쿼리 유지 (홈으로 튕기지 않음) |

---

## 9. 시각 · 토큰

- 색: `theme` 객체만. 화면 로컬 hex 남발 금지
- radius: `uiCornerRadius` (그룹 카드 / 컨트롤 / pill 구분)
- gap·마진: `comfortDensity` · `screenLayout` 상수
- 탭바·헤더 치수: `tabBar` / `screenFixedHeader` 상수
- **피해야 할 기본 AI 룩**: 보라 그라데이션, 크림+테라코타 세리프, 신문형 hairline 다단, 과한 glow·rounded-full pill 클러스터  
  (기존 디자인 시스템이 있으면 그걸 우선)

프론트 랜딩/마케팅 면은 별도 브랜드 히어로 규칙을 적용할 수 있다. **인앱 유틸리티 UI**는 이 Playbook의 밀도·크롬 규칙을 우선한다.

---

## 10. 외부 링크 · 플랫폼

- 설정 가능한 링크는 레지스트리 + `openConfiguredExternalLink`
- iOS/웹: 앱 스킴 우선 → 폴백 웹
- 그리드: 파비콘 + 짧은 라벨, 3~4열 `flexWrap` (카드 남발 금지)

---

## 11. 새 앱 / 새 화면 체크리스트

### 프로젝트 골격

1. [ ] phone / wide 레이아웃 훅과 셸(탭바 vs 사이드바) 분리
2. [ ] `theme` · density · fixed-header · segment 스타일 토큰 파일
3. [ ] 스크롤 뷰포트 마커 + 웹 스크롤바 정책
4. [ ] 날짜 바·세그먼트·헤더·뒤로가기 공통 컴포넌트

### 화면 단위

1. [ ] `useTwoPane` 분기, Safe Area `edges` 명시
2. [ ] 고정 UI → `topFixed` (날짜 → 세그먼트 순서)
3. [ ] 날짜 바 C1 (단일 셸)
4. [ ] wide 루트는 pane fill / 상세만 max-width
5. [ ] 홈형 요약은 2줄 + 설정 가능 개수, 섹션 subtitle 없음
6. [ ] 탭/사이드바 아이콘 outline ↔ filled
7. [ ] 피드는 PTR·chip·필터 시 스크롤 리셋 규칙
8. [ ] 외부 링크는 공통 opener
9. [ ] wide 드릴인만 subpane header, 루트에는 없음

### 문서

1. [ ] 제품 PRD에 화면 역할 한 줄씩
2. [ ] 레이아웃·피드 문서를 이 Playbook에 링크
3. [ ] Admin이 있으면 앱과 분리된 Admin UI 가이드

---

## 12. SIGNAL 구현 매핑 (참고)

| Playbook 개념 | SIGNAL 위치 |
|---|---|
| 반응형 분기 | `constants/responsiveLayout.ts`, `useResponsiveLayout` |
| 고정 헤더 | `constants/screenFixedHeader.ts` |
| 여백 | `constants/screenLayout.ts`, `comfortDensity.ts` |
| 세그먼트 | `constants/segmentTabBar.ts` |
| 날짜 바 | `components/signal/SignalDateNavigator.tsx` |
| wide 셸 | `components/signal/IpadSidebarScreen.tsx`, `WideWebShell` |
| 탭 아이콘 | `app/(tabs)/_layout.tsx`, 사이드바 탭바 |
| 홈 관심 종목·뉴스 흐름 개수 | `services/homeWatchlistDisplayPreference.ts`, `services/homeNewsFlowDisplayPreference.ts` |
| 웹 스크롤바 | `app/+html.tsx` + scroll viewport data attr |
| 피드 chip | `components/signal/FeedNewContentChip.tsx` |

---

## 관련 문서

| 문서 | 용도 |
|---|---|
| [DESIGN-GUIDE.md](./DESIGN-GUIDE.md) | 색·타이포·컴포넌트·화면별 UI |
| [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md) | Safe Area·여백·2-pane·topFixed |
| [FEED-INTERACTION.md](./FEED-INTERACTION.md) | PTR·chip·폴링·캐시 |
| [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md) | 구현·API·외부 링크 |
| [SIGNAL-PRD.md](./SIGNAL-PRD.md) | 제품 방향·화면 역할 |
| [AGENTS.md](./AGENTS.md) | 에이전트 온보딩·문서 인덱스 |
