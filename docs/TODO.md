# SIGNAL TODO

## Product

- 사용자 활동 기반 개인화: 읽은 뉴스, 열어본 종목, 숨긴 출처, 알림 반응을 랭킹에 반영한다.
- 오늘의 시그널 품질: LLM provider 연결 전에도 규칙 기반 점수와 근거 품질을 개선한다.
- 관심 브리핑: 관심종목의 변화, 일정, 뉴스 집중도를 더 명확한 우선순위로 보여준다.

## Platform

- Android alternate app icon: activity-alias 또는 config plugin 방식 검토.
- Web/PWA 아이콘과 manifest 전략 정리.
- Android 출시 QA: push, deep link, social login, status bar, splash 확인.
- iPad 지원 여부 결정과 tablet layout QA.

## Server

- SQLite → Postgres 전환: Flyway baseline을 기준으로 repository interface와 Postgres adapter를 추가하고 운영 source of truth를 전환한다.
- Job lock 운영: 오래된 running 상태 자동 감지와 관리자 강제 해제 기준 개선.
- API 성능: public API payload 최소화, 인덱스 점검, 캐시 TTL 기준 유지.
- Provider 관리: RSS, YouTube, LLM, calendar provider 설정을 Admin에서 일관되게 관리.

## Admin

- Job 설정/실행/이력 화면의 상세 UX 개선.
- 앱 사용자 상세의 세션/소셜/약관/알림 이력 탐색 개선.
- 약관 버전/언어별 관리 화면 개선.
- 다크/라이트 테마 색상 회귀 테스트 자동화.
