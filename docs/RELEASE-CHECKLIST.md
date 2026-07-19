# 릴리즈 체크리스트

## 앱

- [ ] `npx tsc --noEmit` 통과
- [ ] 홈·뉴스·공시·시장·시세·더보기 주요 흐름 확인
- [ ] IT 뉴스: More(iPhone)·사이드바(wide, 내 정보 위) 진입, GeekNews 수집분 표시
- [ ] 퀵 설정 → More settings: iPhone·iPad 모두 설정 pill 탭 표시 / My info 진입은 단일 탭
- [ ] 홈 바로가기: 보드·시세/뉴스 세그먼트 다중 선택·드래그 순서·최대 6. 홈 개수 카드와 분리
- [ ] 홈 바로가기 진입 화면 상단 백(폰 Stack / wide WideSubpaneHeader) → 홈 복귀
- [ ] 홈 숏컷 타일 라벨 한 줄: 기본→상위만, 그 외→`상위·하위`(예: 시세·코인). 보드 숏컷 진입 시 채널 메뉴 없음 (More·탭은 유지)
- [ ] 홈 장중 히어로 → `/market-briefing` 상세. 오늘 정리 히어로 → `/today-briefing`. 섹터 흐름 → `/etf-insight`
- [ ] 홈 뉴스 흐름 행 · 뉴스/공시 목록 행 → `/news-digest`·`/disclosure-digest` 단건 상세. 오늘 정리 본문 없으면 히어로 미노출
- [ ] 브리핑 상세(오늘 정리·장중·ETF·다이제스트): 공통 셸(뒤로+헤드라인+lead+섹션 카드), 가독성·구조 일치
- [ ] 홈 섹션 헤더 `>` 없음(목록은 각 메뉴)
- [ ] 알림→장중: 날짜바·회차 세그먼트·Stack 제목 없음(해당 회차 본문만). 알림→다이제스트/오늘정리/ETF: dateBar·Stack 제목 없음
- [ ] 홈 섹션 표기 **뉴스 흐름** (메뉴 탭 **뉴스**와 구분)
- [ ] 시장 탭: 날짜·회차(미장·장전·장중·마감), 브리핑 본문·종목 가격 표시
- [ ] 피드 PTR: 당겨서 새로고침 시 스크롤 위치 유지 ([FEED-INTERACTION.md](./FEED-INTERACTION.md))
- [ ] 새 소식 chip: scope별 표시·탭 전환 시 독립 동작 (뉴스·공시·시장·알림함)
- [ ] 로그인, 가입, 소셜 로그인, 로그아웃, 탈퇴 확인
- [ ] 알림 권한, push token 등록, 알림함 확인
- [ ] iOS 실기기 하단 safe area, status bar, splash 확인
- [ ] iPad·wide 웹: 사이드바·2-pane·전역 헤더 새로고침 확인
- [ ] 앱 아이콘, alternate icon, deep link 확인

## 서버

- [ ] 운영 DB에 Flyway migration 선적용 (`V19` IT RSS·`geeknews` 포함)
- [ ] `npm --prefix server run start` 기동 확인
- [ ] `/health` 확인
- [ ] `/web`, `/web/news`, `/web/signal` 웹 클라이언트 route 확인
- [ ] `/web/_expo/*`, `/web/assets/*` asset 응답 확인
- [ ] `/news` 같은 root 웹 route가 `/web/news`로 redirect되는지 확인
- [ ] 주요 public API 응답 확인 (`/v1/market-briefings`, `/v1/news`, `/v1/news?category=it` 등)
- [ ] Admin 로그인 확인
- [ ] Job 수동 실행과 이력 저장 확인 (`market_news_it_rss` 포함)
- [ ] Postgres 연결과 기본 Job/Provider/RSS seed 확인 (GeekNews `rss_sources.geeknews`)

## 배포

- [ ] Railway 환경 변수 확인
- [ ] Railway build command가 `npm run railway:build`, start command가 `npm run railway:start`인지 확인
- [ ] EAS secret 확인
- [ ] iOS build number / Android versionCode 증가
- [ ] OTA 가능 변경인지 native rebuild 필요 변경인지 구분
- [ ] [TODO.md](./TODO.md) 후속 과제 반영
