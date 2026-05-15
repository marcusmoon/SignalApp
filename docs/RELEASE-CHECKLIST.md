# SIGNAL Release Checklist

실서비스 배포 직전 확인 항목입니다. 자세한 설정 설명은 `docs/SERVER.md`와 `docs/SOCIAL-AUTH.md`를 함께 봅니다.

## App Build

- `.env` 또는 EAS Secret에 `KAKAO_NATIVE_APP_KEY`가 들어 있고, 네이티브 rebuild가 완료되어 있다.
- EAS 프로젝트 ID를 `EAS_PROJECT_ID`로 넣어 `extra.eas.projectId`가 빌드 manifest에 들어간다.
- 앱 번들 기본 API URL(`EXPO_PUBLIC_SIGNAL_API_BASE_URL`) 또는 앱 설정의 Signal 서버 endpoint가 운영 서버를 가리킨다.
- iOS/Android 스토어 배포 전 `app.json`의 `version`, `ios.buildNumber`, `android.versionCode`가 이전 심사 빌드보다 증가해 있다.
- 현재 앱은 iPhone 중심 출시 기준으로 `ios.supportsTablet=false`다. iPad 지원으로 바꾸려면 iPad 레이아웃과 스크린샷 QA를 먼저 끝낸다.
- iOS/Android 알림 권한 프롬프트가 정상 표시되고, 로그인 후 `/v1/auth/devices`에 Expo push token이 등록된다.
- iOS 원격 푸시를 TestFlight/App Store에서 쓸 때만 `SIGNAL_IOS_REMOTE_PUSH_ENABLED=1`로 빌드한다. 개인 Apple Team 로컬 빌드는 비워두어 APNs entitlement 없이 설치한다.
- `SIGNAL_IOS_REMOTE_PUSH_ENABLED=1` 빌드에서는 Apple Developer App ID에 Push Notifications capability가 켜져 있고, 빌드 산출물에 `aps-environment` entitlement가 포함되어 있다.
- 카카오·네이버·구글·Apple 로그인은 provider 토큰이 아니라 SIGNAL 서버 access/refresh token으로 세션이 저장된다.
- 탈퇴 후 같은 이메일/소셜 계정으로 재가입할 수 있다.
- AdMob을 노출할 계획이면 Google 테스트 광고 ID를 운영 광고 ID로 바꾸고, App Store/Play Store 개인정보·광고 식별자 문항을 실제 사용 기준으로 작성한다.
- 운영 약관/개인정보처리방침 최종 본문을 Admin > 설정 > 약관에 언어별 활성 최신 버전으로 등록한다.

## Railway / Server

- API 서비스와 worker 서비스가 같은 SQLite 볼륨을 바라본다.
- API 서비스: `SIGNAL_SCHEDULER_ENABLED=false`.
- Worker 서비스: `SIGNAL_SCHEDULER_ENABLED=true`.
- `DATA_DIR` 또는 `SQLITE_DB_PATH`가 Railway volume mount 경로를 사용한다.
- `SIGNAL_JWT_PRIVATE_KEY_B64`가 API/worker 양쪽에 설정되어 있고, `/v1/auth/jwt/config`가 `configured=true`, `valid=true`를 반환한다.
- Admin 계정은 SQLite `admin_users`에 생성되어 있으며, `ADMIN_USERS`는 초기 seed 용도로만 사용한다.

## Push / Notifications

- 앱 사용자가 로그인한 뒤 Admin > 앱 사용자 > 디바이스 이력에 push token이 보인다.
- 푸시를 실제 발송하기 전에는 worker에서 `SIGNAL_NOTIFICATION_SENDER_ENABLED=true`, `SIGNAL_NOTIFICATION_PUSH_PROVIDER=mock`으로 outbox 상태 전이를 먼저 확인한다.
- 실제 Expo Push 발송 시 worker에 `SIGNAL_NOTIFICATION_PUSH_PROVIDER=expo`를 설정한다.
- Admin > 앱 사용자 > 푸시/알림 발송에서 테스트 사용자에게 개별 알림을 등록한다.
- Admin > 앱 사용자 > 알림 조회 또는 선택 사용자 상세의 알림 이력에서 `queued → sending → sent/failed/skipped` 상태와 provider/error를 확인한다.
- 앱 알림함에서 서버 알림과 실제 수신 push 기록이 함께 보이는지 확인한다.

## Operations

- 어드민 대시보드의 API 응답 상태에서 p95, 느린 요청, 오류가 정상 집계된다.
- 수집 Job 수동 실행 후 실행 모니터링에서 running/progress/stale 표시가 자연스럽게 갱신된다.
- 오늘의 시그널 Job 실행 후 앱 날짜 선택 화면에서 오늘/과거 날짜 조회가 맞게 동작한다.
- Railway CPU가 높아지면 Admin 대시보드의 느린 API 목록과 Railway 로그의 `[http:slow]` / `[http:very-slow]`를 함께 확인한다.
- 운영에서는 `SIGNAL_HTTP_LOG_ALL=false`를 유지하고, 장애 재현 시에만 잠깐 `true`로 켠다.
