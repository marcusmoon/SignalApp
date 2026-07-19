# 게임센터

더보기 허브의 **게임센터**와 앱 내 웹·네이티브 공통 미니게임 개발 기준이다. 서버 API 없이 클라이언트만으로 동작한다.

UI·테마는 [DESIGN-GUIDE.md](./DESIGN-GUIDE.md), 레이아웃은 [SCREEN-LAYOUT.md](./SCREEN-LAYOUT.md)를 따른다.

## 진입

| 경로 | 동작 |
|---|---|
| **더보기** 허브 타일 | `gameCenter` → `/game-center` |
| 게임센터 카드 | 개별 게임 스택 화면 (예: `/games/sum-trail`) |

- 허브 키·기본 순서: `constants/moreHubOrder.ts` (`gameCenter`는 ETF 뒤·게시판 앞)
- 저장 순서 정규화: `domain/moreHub/normalizeMoreHubOrder` — 기존 저장에 키가 없으면 게시판 앞에 삽입
- iPhone·웹: root Stack 드릴 (`signalDrillStackOptions`)
- iPad·2-pane: 더보기에서 `/game-center`로 push (탭 전환 아님)

## 디렉터리

| 역할 | 위치 |
|---|---|
| 게임센터 허브 화면 | `app/game-center.tsx` |
| 개별 게임 화면 | `app/games/<game-id>.tsx` |
| 게임 UI | `components/games/` |
| 규칙·순수 로직 | `domain/games/<gameId>/` |
| 허브 타일 메타 | `app/(tabs)/more.tsx` `HUB_META.gameCenter` |
| 문자열 | `locales/ko.ts` · `en.ts` · `ja.ts` (`screenGameCenter`, `game*` 키) |

제품 규칙(보드 생성·경로 검증·클리어)은 **반드시** `domain/games/`에 두고, 화면은 상태·입력·표시만 담당한다. 단위 테스트는 `domain/games/**/*.test.ts`.

## 새 게임 추가

1. `domain/games/<id>/` — 순수 함수·상태 전이 + `*.test.ts`
2. `components/games/<Name>Game.tsx` — `useSignalTheme()` 토큰만 사용
3. `app/games/<id>.tsx` — Stack 헤더 + ScrollView 셸
4. `app/game-center.tsx`의 `GAMES` 배열에 카드 추가 (`titleId` / `bodyId`)
5. `locales` 세 언어에 동일 키 추가
6. `app/_layout.tsx` `titleByName`에 라우트 제목 등록 (필요 시)

서버·Admin·캐시 연동은 두지 않는다. 점수·최고 기록 저장이 필요하면 `services/` + AsyncStorage만 쓰고, Signal API에 올리지 않는다.

## 합 트레일 (Sum Trail)

첫 탑재 게임. 격자 위 인접(상하좌우) 칸을 이어 **경로 합 = 목표**이면 해당 칸을 지우고 열 단위로 아래로 압축한다. 목표 클리어 횟수에 도달하면 레벨 클리어.

| 항목 | 값 |
|---|---|
| 라우트 | `/games/sum-trail` |
| 로직 | `domain/games/sumTrail/sumTrail.ts` |
| UI | `components/games/SumTrailGame.tsx` |
| 난이도 | `easy` · `normal` · `hard` (`levelConfig`) |
| 조작 | 칸 탭으로 경로 연장 · 마지막 칸 재탭/Undo로 취소 · 경로 지우기 · 레벨 다시 |
| 연출 | 숫자 구간별 타일 색 · 합 진행 바 · 목표 근접(경고)/초과(위험) 틴트 · 맞춤·레벨 클리어 버스트 오버레이 |

생성 시 시드로 유효 경로를 하나 골라 목표를 정한다 (`pickTarget`). 보드가 비거나 다음 목표를 못 고르면 레벨 클리어로 처리한다.

## UI 규칙

- 테마 hex 직접 사용 금지 — `theme` / `scaleFont`만
- 카드·보드는 `UI_RADIUS_CARD` · `UI_RADIUS_CARD_LG`
- 게임센터·게임 화면은 `APP_CONTENT_MAX_WIDTH` + `stackScreenScrollBottomPadding`
- 햅틱은 선택(`expo-haptics`). 실패해도 무시

## 검증

```bash
npm test          # domain/games 포함
npm run typecheck
```

수동: 더보기 → 게임센터 → 합 트레일에서 난이도 전환·경로 합 맞춤·레벨 클리어를 확인한다.
