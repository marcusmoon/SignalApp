# 릴리즈 체크리스트

## 앱

- [ ] `npx tsc --noEmit` 통과
- [ ] 뉴스, 시그널, 시세, 더보기 주요 흐름 확인
- [ ] 시그널 탭: 날짜·국내/미국 전환, 브리핑 전체 본문·종목 가격 표시 확인
- [ ] 로그인, 가입, 소셜 로그인, 로그아웃, 탈퇴 확인
- [ ] 알림 권한, push token 등록, 알림함 확인
- [ ] iOS 실기기 하단 safe area, status bar, splash 확인
- [ ] 앱 아이콘, alternate icon, deep link 확인

## 서버

- [ ] 운영 DB에 Flyway migration 선적용
- [ ] `npm --prefix server run start` 기동 확인
- [ ] `/health` 확인
- [ ] `/web`, `/web/news`, `/web/signal` 웹 클라이언트 route 확인
- [ ] `/web/_expo/*`, `/web/assets/*` asset 응답 확인
- [ ] `/news` 같은 root 웹 route가 `/web/news`로 redirect되는지 확인
- [ ] 주요 public API 응답 확인 (`/v1/market-briefings`, `/v1/news` 등)
- [ ] Admin 로그인 확인
- [ ] Job 수동 실행과 이력 저장 확인
- [ ] Postgres 연결과 기본 Job/Provider/RSS seed 확인

## 배포

- [ ] Railway 환경 변수 확인
- [ ] Railway build command가 `npm run railway:build`, start command가 `npm run railway:start`인지 확인
- [ ] EAS secret 확인
- [ ] iOS build number / Android versionCode 증가
- [ ] OTA 가능 변경인지 native rebuild 필요 변경인지 구분
- [ ] 문서와 TODO 업데이트
