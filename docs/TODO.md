# SIGNAL TODO

## Product

- **이슈 개정 운영 전환**: V21 → 서버 배포 → v3 collect/validate → 표본 검수 → 예약 재개. 개정 모델/기업 타임라인 코드는 구현했으나 운영 반영·실기기 확인은 별도. 제목 유사도만으로 병합하지 않고 검증용 뉴스셋으로 신규성/정정/독립 출처를 점검한다. [제품 방향](./SIGNAL-PRODUCT-UPGRADE.md)
- **관심종목 그룹·사건 구독**: 그룹별 뉴스 필터와 개별 사건 후속 알림. 계정 동기화·구독 해제·탈퇴 정리를 함께 설계한다. 현재 v3 알림은 기존 카테고리 알림 경로를 사용한다.
- **읽음·저장 동기화**: 홈 이슈는 현재 기기 로컬(최대 300개 개정판)에서 읽음 표시. 계정/기기간 동기화는 동의·보존·삭제 정책과 함께 구현. 서버 랭킹에는 아직 사용하지 않음.
- **읽기 품질 측정**: 첫 유효 콘텐츠 시간, 부분 실패율, 원문 링크 유효성, 중복 이슈율의 측정 정의와 개인정보 범위를 확정한다.
- 시장 브리핑 품질: ingest payload의 종목 가격·등락률 필드 활용과 회차별 비교 UX를 개선한다.
- **시장 주간·월간 브리핑**: 일간 외 주/월 요약 제공. 화면은 상단 기간 세그먼트(일·주·월) + 기간별 네비게이터(일=날짜, 주=거래주, 월=달) + 2단 탭(일간=회차 4탭, 주·월=국내·미국). 본문은 `MarketBriefingBlock` 스키마 재사용. 서버는 `market_briefings`에 `period`(daily/weekly/monthly), `period_start`/`period_end` 확장 검토.
- **IT 뉴스 소스 확대**: 현재 GeekNews(`news.hada.io/rss/news`)만. 필요 시 해외 유명 매체·국내 IT지 RSS를 `category=it`에 추가(Admin RSS + `market_news_it_rss`의 `rssSourceIds`).
- **IT 뉴스 UX**: unread 배지(More·사이드바), 허브 타일 순서 저장과의 정합, 번역 토글·다이제스트 연동 여부 검토.

## Platform

- **웹 hydration 검증**: 정적 export의 `/news-digest` 첫 진입에서 React #418 관찰. 모바일/와이드 화면과 저장·이력 동작은 복구 후 정상이나 SSR/초기 클라이언트 상태 차이를 별도 추적한다. 이슈 v3의 운영 데이터 검증과 구분한다.

- **Expo SDK 56 후속**: EAS iOS preview/production 네이티브 재빌드, Xcode 27 / iOS 27 시뮬레이터·실기기 QA(런치·앱 상태·딥링크·카카오 로그인·푸시).
- **UIScene**: Expo prebuild 템플릿에 `SceneDelegate`가 npm에 포함되면 `plugins/withIosSceneLifecycle.js` 제거.
- **앱 아이콘**: `icon.png`·`adaptive-icon.png`를 정사각형으로 교체(expo-doctor 스키마 경고).
- Android alternate app icon: activity-alias 또는 config plugin 방식 검토.
- Web/PWA 아이콘과 manifest 전략 정리.
- Android 출시 QA: push, deep link, social login, status bar, splash 확인.
- iPad·wide 웹 레이아웃 QA: 2-pane, 사이드바 서브탭(IT 뉴스 포함), PTR·chip, 퀵설정→전체 설정 탭 통일.

## Server

- **Flyway squash 배포**: 기존 V23 DB는 데이터 유지 + `rebaseFlywayHistoryToV1.sql` 후 `flyway baseline -baselineVersion=1` (V1 SQL 재실행 금지). 신규만 `flyway migrate`. 글로벌 Finnhub+FJ, 실적 PR RSS off.
- Postgres 운영 고도화: public API direct SQL 범위를 확대하고 heavy read 경로의 인덱스/쿼리 플랜을 정기 점검한다.
- DB 접근 계층 정리: Kysely repository를 기능별로 확대하고 legacy raw SQL 집중도를 낮춘다.
- Job lock 운영: 오래된 running 상태 자동 감지와 관리자 강제 해제 기준 개선.
- API 성능: public API payload 최소화, 인덱스 점검, 캐시 TTL 기준 유지.
- Provider 관리: RSS, YouTube, LLM, calendar provider 설정을 Admin에서 일관되게 관리.

## Admin

- Job 설정/실행/이력 화면의 상세 UX 개선.
- 앱 사용자 상세의 세션/소셜/약관/알림 이력 탐색 개선.
- 약관 버전/언어별 관리 화면 개선.
- 다크/라이트 테마 색상 회귀 테스트 자동화.
