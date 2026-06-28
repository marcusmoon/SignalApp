# SIGNAL

SIGNAL은 Codex 시장 브리핑, 뉴스, 시세, 투자 캘린더를 Signal Server에서 수집·정제해 앱에서 빠르게 확인하는 투자 정보 앱입니다. 앱은 외부 provider를 직접 호출하지 않고 Signal Server API만 사용합니다.

탭 구성: **뉴스 · 공시 · 시그널 · 시세 · 더보기**

## 빠른 실행

```bash
npm install
npm run start
npm run ios
npm run android
npm run web
npm run server:dev
```

## 주요 구성

| 영역 | 설명 |
|---|---|
| `app/` | Expo Router 화면 |
| `components/` | 공용 UI 컴포넌트 |
| `domain/` | 제품 규칙, 정렬, 분류, 시드 데이터 |
| `integrations/signal-api/` | 앱의 Signal Server API 클라이언트 |
| `services/` | 앱 설정, AsyncStorage, 세션, 캐시 오케스트레이션 |
| `server/` | Signal Server, Admin, 수집 Job, Postgres 저장소 |
| `plugins/` | Expo config plugin |
| `docs/` | 최종 운영 문서 |

## 문서

- [제품 요구사항](./docs/SIGNAL-PRD.md)
- [앱/서버 아키텍처](./docs/ARCHITECTURE.md)
- [서버 운영](./docs/SERVER.md)
- [Expo/EAS 운영](./docs/EXPO-EAS-OPERATIONS.md)
- [소셜 로그인](./docs/SOCIAL-AUTH.md)
- [릴리즈 체크리스트](./docs/RELEASE-CHECKLIST.md)
- [후속 작업](./docs/TODO.md)
