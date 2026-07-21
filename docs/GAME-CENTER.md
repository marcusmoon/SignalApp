# 게임

더보기·사이드바의 **게임** 허브와 앱 내 웹·네이티브 공통 미니게임 개발 기준이다. 서버 API 없이 클라이언트만으로 동작한다. (라우트·허브 키는 `game-center` / `gameCenter`를 유지한다.)

UI·테마는 [DESIGN-GUIDE.md](./DESIGN-GUIDE.md), 레이아웃은 [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md)를 따른다.

## 진입

| 경로 | 동작 |
|---|---|
| **더보기** 허브 타일 (iPhone) | `gameCenter` → `/game-center` |
| **사이드바** (iPad·와이드 웹) | 게시판 다음 **게임** → `/game-center` |
| 게임 허브 카드 | 개별 게임 스택 화면 (예: `/games/sum-trail`) |

- 허브 키·기본 순서: `constants/moreHubOrder.ts` (`gameCenter`는 게시판 바로 뒤)
- 저장 순서 정규화: `domain/moreHub/normalizeMoreHubOrder` — 없으면 게시판 뒤에 삽입, 예전에 앞이던 저장분도 뒤로 이동
- iPad·와이드 웹: 사이드바 **게시판 다음** **게임** → `/game-center` (`SignalSidebarTabBar`, 루트 pane·드릴 백 없음)
- 합 트레일 드릴: `WideSubpaneHeader` + 가로/넓은 pane **보드|조작 2열**
- iPhone: root Stack 드릴 (`signalDrillStackOptions`)
- 표시 라벨: `screenGameCenter` → **게임** / Games / ゲーム

## 디렉터리

| 역할 | 위치 |
|---|---|
| 게임 허브 화면 | `app/game-center.tsx` (`GameHubContent`) |
| 개별 게임 화면 | `app/games/<game-id>.tsx` |
| 게임 UI | `components/games/` (`SumTrail*`, `Sudoku*`, `GameRecordsSheet`) |
| 규칙·순수 로직 | `domain/games/<gameId>/` |
| 허브 타일 메타 | `app/(tabs)/more.tsx` `HUB_META.gameCenter` |
| 사이드바 | `components/signal/SignalSidebarTabBar.tsx` |
| 문자열 | `locales/ko.ts` · `en.ts` · `ja.ts` (`screenGameCenter`, `game*` 키) |

제품 규칙(보드 생성·경로 검증·클리어)은 **반드시** `domain/games/`에 두고, 화면은 상태·입력·표시만 담당한다. 단위 테스트는 `domain/games/**/*.test.ts`.

## 새 게임 추가

1. `domain/games/<id>/` — 순수 함수·상태 전이 + `*.test.ts`
2. `components/games/<Name>Game.tsx` — `useSignalTheme()` 토큰만 사용 · 가능하면 `wide` prop
3. `app/games/<id>.tsx` — 폰 Stack / 와이드 `WideSubpaneHeader` 분기
4. `app/game-center.tsx`의 `GAMES` 배열에 카드 추가 (`titleId` / `bodyId`)
5. `locales` 세 언어에 동일 키 추가
6. `app/_layout.tsx` `titleByName`·`wideOverlayStackRoutes`에 라우트 등록

서버·Admin·캐시 연동은 두지 않는다. **이어하기·통산 기록**은 `services/gameProgressStore` · `services/gameRecordsStore` + AsyncStorage만 쓴다 (Signal API 없음).

### 이어하기 · 기록

| 구분 | 저장 | 내용 |
|---|---|---|
| 진행 | `gameProgressStore` | 합 트레일·스도쿠 보드 스냅샷. 재진입 시 자동 복원. 난이도 변경·스도쿠 완주 시 해당 진행 삭제 |
| 기록 | `gameRecordsStore` | 플레이 횟수, 레벨/완주 수, 최고 레벨·점수, 스도쿠 난이도별 최단 시간·최소 실수 |
| UI | 게임 허브 **게임 기록** 시트 · 카드 **이어하기** 배지 | `GameRecordsSheet` |

규칙 정규화·이벤트는 `domain/games/records`, 스냅샷 파서는 `domain/games/progress`.

## 합 트레일 (Sum Trail)

첫 탑재 게임. 격자 위 인접(상하좌우) 칸을 이어 **경로 합 = 목표**이면 해당 칸을 지우고 열 단위로 아래로 압축한다. 목표 클리어 횟수에 도달하면 레벨 클리어.

| 항목 | 값 |
|---|---|
| 라우트 | `/games/sum-trail` |
| 로직 | `domain/games/sumTrail/sumTrail.ts` |
| UI | `components/games/SumTrailGame.tsx` |
| 난이도 | `easy` · `normal` · `hard` (`levelConfig`) |
| 조작 | 칸 탭 · Undo · 경로 지우기 · **힌트**(레벨당 횟수) · 레벨 다시 |
| 힌트 | 쉬움 3 / 보통 2 / 어려움 1회. 올바른 다음 칸 강조. **추후 포인트로 추가 구매** 예정 |
| 실패 | 합이 목표를 **초과**하거나, 목표에 도달하기 전에 **둘 칸이 없으면** `failed`. 실패 버스트·보드 흔들림·에러 햅틱 |
| 연출 | 숫자 구간별 타일 색 · 합 진행 바 · 목표 근접/초과/**일치** 틴트 · 맞춤·레벨 클리어 버스트(`GameBurstOverlay`) · 보드 펄스/흔들림 |
| 와이드 | 사이드바 루트(백 없음) · 가로/넓은 pane에서 보드\|조작 2열 · 보드 크기 viewport 연동 |
| 폰 | **화면 채움** (`fill`): Scroll 없이 가용 높이에 보드 맞춤. 설명은 `?` → `SumTrailHelpSheet` 바텀 시트 |

생성 시 시드로 유효 경로를 하나 골라 목표를 정한다 (`pickTarget`). 보드가 비거나 다음 목표를 못 고르면 레벨 클리어로 처리한다.

### 후속 (미구현)

- 힌트 추가 충전을 **포인트/재화로 구매**
- 일일 힌트 리필·광고 시청 리워드와 연동 가능

## 스도쿠 (Sudoku)

클래식 9×9 숫자 퍼즐. 행·열·3×3 박스에 1–9가 겹치지 않게 채운다.

| 항목 | 값 |
|---|---|
| 라우트 | `/games/sudoku` |
| 로직 | `domain/games/sudoku/sudoku.ts` |
| UI | `components/games/SudokuGame.tsx` |
| 난이도 | `easy`(≈40 힌트칸) · `normal`(≈32) · `hard`(≈26) |
| 조작 | 칸 선택 · 1–9 패드 · 지우기 · Undo · **힌트** · 다시 · 새 게임 |
| 힌트 | 쉬움 3 / 보통 2 / 어려움 1회. 빈칸(또는 틀린 칸)에 정답 채움 |
| 실수 | 정답과 다른 숫자 입력 시 카운트. 행·열·박스 충돌은 빨간 강조 · **칸 흔들림·보드 FX** |
| 연출 | 칸 팝/흔들림 · 힌트/완주 버스트 · 숫자 패드 누름 · 보드 펄스/흔들림 (`GameBurstOverlay`) |
| 레이아웃 | 합 트레일과 동일 — 폰 fill · `?` 바텀 시트 · 와이드 가로 2열 |

### 후속 (미구현)

- 메모(연필) 모드
- 힌트 포인트 구매

## UI 규칙

- 테마 hex 직접 사용 금지 — `theme` / `scaleFont`만
- 카드·보드는 `UI_RADIUS_CARD` · `UI_RADIUS_CARD_LG`
- 폰: `APP_CONTENT_MAX_WIDTH` + fill 레이아웃 · 합 트레일 설명은 바텀 시트
- 와이드: `APP_WIDE_CONTENT_MAX_WIDTH` / `wideContentFill` + `SCREEN_WIDE_SCROLL_BOTTOM_BASE`
- 햅틱은 선택(`expo-haptics`). 실패해도 무시
- 공용 FX: `components/games/GameBurstOverlay.tsx` · `gameBoardFx.ts`

## 검증

```bash
npm test          # domain/games 포함
npm run typecheck
```

수동: 더보기·사이드바 → 게임 → 합 트레일·스도쿠에서 난이도 전환·클리어·와이드 레이아웃을 확인한다.
