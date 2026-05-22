# SIGNAL 사용법 및 운영 가이드

현재 개발된 SIGNAL 앱과 어드민 기능을 기준으로 한 사용/운영 문서입니다.

## 1. 개요

SIGNAL은 미국 시장과 코인/매크로 흐름을 보는 한국 개인 투자자를 위한 투자 정보 앱입니다. 앱은 Signal API만 조회하며, 외부 provider key와 수집/번역/인사이트 생성은 서버와 어드민에서 관리합니다.

## 2. 앱 사용법

- 뉴스 탭: 오늘의 시그널, 새 업데이트 안내, 글로벌/코인/영상/내 관심 세그먼트를 확인합니다.
- 오늘의 시그널: 날짜 이동과 날짜 선택으로 생성일 기준 시그널을 조회합니다. 관심종목만 보기로 개인 티커 관련 항목만 좁힐 수 있습니다.
- 시세 탭: 관심, 인기, 시총, 코인 리스트를 전환합니다. 종목을 누르면 종목 상세로 이동합니다.
- 관심 브리핑: 내 관심종목 전체의 체크포인트, 종목별 사유, 시장 요약, 일정 정보를 봅니다.
- 유튜브 탭: 경제 채널 영상을 최신순/인기순으로 확인합니다.
- 알림함: 로그인 후 서버 알림과 실제 push 수신 기록을 확인합니다.
- 내정보: 소셜 계정, 이메일 로그인, 약관 동의 이력, 알림 설정, 로그아웃/탈퇴를 관리합니다.

## 3. 어드민 사용법

- 대시보드: 데이터 상태, 콘텐츠 현황, API 응답 상태, 최근 시그널을 확인합니다.
- 콘텐츠 수집 관리: 수집 Job, 실행 모니터링, 인사이트 결과, 실패/오류 로그를 관리합니다.
- 뉴스/유튜브/캘린더/컨콜: 수집된 콘텐츠를 조회하고 필요한 번역/태그/출처 설정을 조정합니다.
- 앱 사용자: 사용자 검색 후 알림, 약관, 디바이스, 인증 토큰, 소셜 계정, 계정 이벤트를 탭으로 확인합니다.
- 푸시/알림 발송: 전체/세그먼트/사용자 대상으로 알림을 등록하고 outbox 상태를 추적합니다.
- 설정: Provider key, 번역, 마켓 리스트, 약관, 어드민 사용자를 관리합니다.

## 4. 운영 구조

- 운영은 API 서비스와 worker 서비스를 분리합니다.
- API는 `SIGNAL_SCHEDULER_ENABLED=false`, worker는 `SIGNAL_SCHEDULER_ENABLED=true`를 사용합니다.
- SQLite 파일은 `DATA_DIR` 또는 `SQLITE_DB_PATH`로 지정하고 Railway volume mount 경로를 사용합니다.
- 알림은 `notification_items` outbox에 먼저 쌓이고 worker sender가 `queued`, `sending`, `sent/failed/skipped`로 전이합니다.

## 5. 출시 전 체크

- `KAKAO_NATIVE_APP_KEY`, `EAS_PROJECT_ID`, `SIGNAL_JWT_PRIVATE_KEY_B64` 설정을 확인합니다.
- iOS remote push 빌드는 `SIGNAL_IOS_REMOTE_PUSH_ENABLED=1`로 빌드합니다.
- 소셜 로그인은 provider token이 아니라 SIGNAL JWT 세션으로 저장되는지 확인합니다.
- 운영 약관/개인정보처리방침을 Admin 설정에 활성 최신 버전으로 등록합니다.
- AdMob을 쓸 경우 테스트 ID를 운영 ID로 교체하고 스토어 개인정보 문항을 실제 사용 기준으로 작성합니다.

## 6. 문제 해결

- API가 느리면 Admin 대시보드의 API 응답 상태와 Railway 로그의 `[http:slow]` / `[http:very-slow]`를 함께 봅니다.
- Job이 멈춘 것처럼 보이면 실행 모니터링에서 `progressUpdatedAt`과 stale 표시를 확인합니다.
- JWT 오류는 `/v1/auth/jwt/config`에서 `configured=true`, `valid=true`인지 확인합니다.
- 카카오 `KOE101`은 네이티브 앱 키, URL scheme, Bundle ID/package/key hash 불일치가 주요 원인입니다.
