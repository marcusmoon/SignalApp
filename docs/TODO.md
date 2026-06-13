# SIGNAL TODO

## Product

- 사용자 활동 기반 개인화: 읽은 뉴스, 열어본 종목, 숨긴 출처, 알림 반응을 랭킹에 반영한다.
- 오늘의 시그널 품질: LLM provider 연결 전에도 규칙 기반 점수와 근거 품질을 개선한다.
- 관심 브리핑: 관심종목의 변화, 일정, 뉴스 집중도를 더 명확한 우선순위로 보여준다.
- 투자 관점 고도화: 기업 체력에는 매출/이익률/컨콜 감성, 리스크에는 규제·섹터 집중도, 장기 시나리오에는 thesis 변경 감지를 연결한다.

## Platform

- Android alternate app icon: activity-alias 또는 config plugin 방식 검토.
- Web/PWA 아이콘과 manifest 전략 정리.
- Android 출시 QA: push, deep link, social login, status bar, splash 확인.
- iPad 지원 여부 결정과 tablet layout QA.

## Server

- Postgres 운영 고도화: public API direct SQL 범위를 확대하고 heavy read 경로의 인덱스/쿼리 플랜을 정기 점검한다.
- DB 접근 계층 정리: 이미 도입한 `Kysely`를 기능별 repository로 확대하고 `server/src/db.mjs`의 raw SQL 집중도를 낮춘다.
- Job lock 운영: 오래된 running 상태 자동 감지와 관리자 강제 해제 기준 개선.
- API 성능: public API payload 최소화, 인덱스 점검, 캐시 TTL 기준 유지.
- Provider 관리: RSS, YouTube, LLM, calendar provider 설정을 Admin에서 일관되게 관리.

## Admin

- Job 설정/실행/이력 화면의 상세 UX 개선.
- 앱 사용자 상세의 세션/소셜/약관/알림 이력 탐색 개선.
- 약관 버전/언어별 관리 화면 개선.
- 다크/라이트 테마 색상 회귀 테스트 자동화.
