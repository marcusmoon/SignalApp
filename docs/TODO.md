# SIGNAL TODO

## Product

- 사용자 활동 기반 개인화: 읽은 뉴스, 열어본 종목, 숨긴 출처, 알림 반응을 랭킹에 반영한다.
- 시장 브리핑 품질: ingest payload의 종목 가격·등락률 필드 활용과 회차별 비교 UX를 개선한다.
- **시그널 주간·월간 브리핑**: 일간 외 주/월 요약 제공. 화면은 상단 기간 세그먼트(일·주·월) + 기간별 네비게이터(일=날짜, 주=거래주, 월=달) + 2단 탭(일간=회차 4탭, 주·월=국내·미국). 본문은 `MarketBriefingBlock` 스키마 재사용(headline, overview, sectors, companies, macro, sourceRefs). 서버는 `market_briefings`에 `period`(daily/weekly/monthly), `period_start`/`period_end` 확장 검토. Codex 생성 주기: 주간(금 장후), 월간(월초). Phase 0 UI shell → API/ingest → 자동화·푸시 순 롤아웃.

## Platform

- **Expo SDK 56 후속**: EAS iOS preview/production 네이티브 재빌드, Xcode 27 / iOS 27 시뮬레이터·실기기 QA(런치·앱 상태·딥링크·카카오 로그인·푸시).
- **UIScene**: Expo prebuild 템플릿에 `SceneDelegate`가 npm에 포함되면 `plugins/withIosSceneLifecycle.js` 제거.
- **앱 아이콘**: `icon.png`·`adaptive-icon.png`를 정사각형으로 교체(expo-doctor 스키마 경고).
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
- **Job 영역별 재묶음·운영 정리**: 현재 `domain` 단일 그룹(뉴스·캘린더·유튜브·마켓·인사이트·기타)만으로는 수집/가공/보정 Job이 섞여 분산돼 보인다. Admin Job 보드를 **제품 영역(앱 탭 정렬) × 운영 단계(수집 ingest / 가공 enrich / 보정 reconcile)** 2단으로 재구성하고, `digest` operation 필터·배지 추가, `quant` 등 레거시는 접는 섹션으로 분리. 중장기로 `server/src/jobs/catalog.mjs`(그룹·짝 Job·dependsOn·라벨 단일 기준), DB `area`/`stage`/`pair_job_key` 컬럼, **영역별 일괄 실행 preset**(뉴스 새로고침=수집→digest, 시그널=insights 등), 대시보드 **영역별 신호등**(마지막 성공·0건·lock) 검토. 단기는 UI/catalog만, 안정 후 latest+reconcile handler 통합으로 Job row 축소 검토.
- 앱 사용자 상세의 세션/소셜/약관/알림 이력 탐색 개선.
- 약관 버전/언어별 관리 화면 개선.
- 다크/라이트 테마 색상 회귀 테스트 자동화.
