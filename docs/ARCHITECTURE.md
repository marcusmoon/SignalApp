# SIGNAL 아키텍처

## 앱 구조

| 경로 | 역할 |
|---|---|
| `app/` | Expo Router 화면 |
| `components/` | UI 컴포넌트 |
| `constants/` | 전역 테마, 탭, 공통 상수 |
| `contexts/` | Locale, Theme, OTA 등 React Context |
| `domain/` | 정렬, 분류, 시드, 순수 제품 규칙 |
| `integrations/` | Signal API, AdMob, Expo Updates 어댑터 |
| `services/` | AsyncStorage, 세션, 설정, 캐시 오케스트레이션 |
| `utils/` | 날짜, 링크, 표시 유틸 |
| `locales/` | ko/en/ja 문자열 |

앱 화면은 외부 서비스를 직접 호출하지 않는다. 모든 피처 데이터는 `integrations/signal-api/`를 통해 Signal Server에서 가져온다.

## 서버 구조

| 경로 | 역할 |
|---|---|
| `server/src/http/public/v1/` | 앱 공개 API |
| `server/src/http/admin/api/` | Admin API |
| `server/src/db/` | SQLite schema/store/repository |
| `server/src/jobs/` | 수집·인사이트 Job |
| `server/src/providers/` | RSS, YouTube, calendar, LLM 등 provider |
| `server/src/public/admin/` | Admin 정적 UI |

## DB 원칙

- SQLite 파일은 `DATA_DIR` 기준으로 둔다.
- 기능별 테이블과 store 모듈을 사용한다.
- 앱 공개 API에서 중복 제거와 최소 응답을 적용한다.
- Job lock TTL은 Job 설정 기준으로 관리한다.
- MySQL 이전을 고려해 payload-only 의존을 줄이고 조회 컬럼과 인덱스를 유지한다.

## 네이티브 구조

`ios/`, `android/`는 Expo prebuild 산출물이다. 재현 가능한 변경은 `app.config.js`와 `plugins/`에 둔다. Xcode에서 직접 빌드하더라도 native 수정은 config plugin으로 반영 가능해야 한다.
