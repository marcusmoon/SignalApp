# SIGNAL — Later Tasks

이 문서는 당장 작업 범위에서는 제외하지만, 이후 제품 품질과 운영성을 위해 다시 볼 항목을 관리한다.

## Mobile / Web


### 사용자 활동 기반 개인화 고도화

- 상태: Backlog
- 배경: 현재 홈 개인화는 기기 관심종목과 서버 수집 데이터를 결합하는 수준이다. 출시 후에는 사용자가 실제로 읽은 뉴스, 열어 본 종목, 숨긴 출처, 푸시 반응까지 반영해야 신호 품질이 올라간다.
- 방향:
  - 앱 사용자별 watchlist / read history / dismissed signal / notification open 이벤트를 서버에 저장
  - `/v1/watch-signals` 랭킹에 사용자 활동 가중치 추가
  - 같은 종목이라도 “최근 자주 본 종목”, “알림을 열었던 주제”, “사용자가 숨긴 출처”를 반영
  - 개인정보/동의 범위와 이벤트 보관 기간을 약관/설정과 연결
- 완료 기준:
  - 로그인 사용자와 비로그인 사용자 랭킹 기준을 분리
  - 개인화 사용 여부를 앱 설정에서 제어
  - 어드민에서 사용자별 주요 활동/알림 반응 요약 확인

### 앱 아이콘 사용자 선택 확장

- 상태: Backlog
- 배경: iOS는 `alternateIconName`으로 앱 내부에서 홈 화면 아이콘 변경을 지원하지만, Android와 Web은 동일한 방식으로 즉시 변경하기 어렵다.
- Android 방향:
  - `activity-alias` 기반 런처 아이콘 전환 가능성 검토
  - 제조사 런처별 캐시/반영 지연 테스트
  - Expo config plugin 또는 bare native module로 구현할지 결정
  - 기존 iOS 아이콘 variant와 동일한 asset source를 재사용
- Web 방향:
  - 일반 브라우저 탭 favicon은 사용자 설정에 따라 런타임 교체 가능
  - PWA 설치 아이콘은 manifest와 브라우저 캐시 정책 때문에 즉시 변경 보장이 어려우므로, 테마별 manifest 전략 검토
  - 웹 설정 화면에서는 “브라우저 탭 아이콘만 변경”처럼 적용 범위를 명확히 표시
- 완료 기준:
  - Android 실기기에서 아이콘 변경, 앱 재실행, 런처 캐시 동작 확인
  - Web/PWA에서 변경 가능한 범위와 불가능한 범위를 문서화
  - 설정 UI에서 플랫폼별 지원 상태를 혼동 없이 표시

### iPad / 태블릿 지원 검토

- 상태: Backlog
- 배경: 현재 출시 기준은 iPhone 중심이며 `ios.supportsTablet=false`다. iPad 지원은 단순 빌드 옵션 변경이 아니라 레이아웃 QA가 필요하다.
- 방향:
  - 홈, 뉴스, 시세, 유튜브, 관심 브리핑, 종목 상세, 내정보의 tablet breakpoint 정의
  - split/detail 패턴이 필요한 화면과 모바일 1열 유지 화면 구분
  - App Store iPad 스크린샷/심사 기준 확인
- 완료 기준:
  - iPad simulator와 실기기에서 주요 탭/상세/로그인/설정 QA
  - `ios.supportsTablet=true` 전환 여부 결정

### Android 출시 QA

- 상태: Backlog
- 배경: 제품 방향은 iOS 우선, Android 병행이지만 최근 네이티브 이슈 대응은 iOS에 집중되어 있었다.
- 방향:
  - Android push token 등록, 알림 권한, foreground/background 알림 동작 확인
  - 하단 탭 safe area, splash, status bar, 앱 아이콘, deep link 동작 확인
  - 카카오/네이버/구글 소셜 로그인 Android redirect 및 native config 확인
- 완료 기준:
  - Android 실제 기기에서 가입, 로그인, 뉴스/시세/유튜브/알림 주요 흐름 통과
  - Play Store 빌드 전 `android.versionCode`와 권한/개인정보 항목 검토

### Web/PWA 제품 범위 정리

- 상태: Backlog
- 배경: Expo Web으로 실행은 가능하지만 앱 중심 기능(push, native social login, app icon 변경)은 플랫폼별 제약이 있다.
- 방향:
  - Web에서 공식 지원할 화면과 제한할 기능을 명확히 분리
  - favicon/theme-color/manifest, responsive layout, 로그인 redirect 정책 정리
  - PWA 설치 가능성을 별도 제품 범위로 둘지 결정
- 완료 기준:
  - Web 지원 범위 문서화
  - 지원하지 않는 native 기능은 UI에서 명확히 안내

## Insights / AI

### LLM 이전 규칙 기반 인사이트 품질 고도화

- 상태: Backlog
- 배경: SIGNAL의 차별화는 LLM 연동 자체보다 “왜 지금 봐야 하는지”를 매일 빠르게 판단하게 하는 데 있다. Claude/OpenAI를 붙이기 전에도 저장된 뉴스·영상·시세·캘린더만으로 충분히 의미 있는 규칙 기반 인사이트를 만들어야 한다.
- 방향:
  - `insights_market_brief`의 ranking 기준을 최신순이 아니라 관심종목 연관도, 가격 변동, 뉴스 밀도, 일정 임박도, 소스 다양성 중심으로 정리
  - 각 인사이트에 `whyNow`, 핵심 변화, 관련 종목, 근거 뉴스/영상/일정, 다음 확인 포인트를 필수 구조로 유지
  - 오래된 원천 데이터가 오늘의 시그널에 섞이지 않도록 freshness window와 감점 기준 명확화
  - 중복 브리핑/중복 심볼 결과를 줄이고, 같은 이슈는 하나의 대표 시그널로 묶는 grouping 기준 강화
  - 홈에서는 전체 결과가 아니라 “지금 볼 가치가 높은 1~3개”만 노출하고, 나머지는 오늘의 시그널 전체 화면에서 확인
- 완료 기준:
  - LLM provider off 상태에서도 홈/오늘의 시그널이 매일 볼 만한 후보를 안정적으로 생성
  - 어드민 인사이트 결과에서 점수 산정 이유와 제외/감점 이유를 확인 가능
  - 관심종목이 있는 사용자와 없는 사용자에게 서로 다른 우선순위가 적용됨
  - 최근성, 관련도, 근거 수, 중복 제거 기준이 문서화됨

### LLM 기반 오늘의 시그널 생성 연결

- 상태: Backlog
- 배경: 현재 `insights_market_brief`는 규칙 기반으로 동작하고, Claude/OpenAI 설정이 있으면 추후 호출용 `llmPromptInput`만 저장한다.
- 방향:
  - Provider 설정에서 Claude/OpenAI 기본 모델이 활성일 때 실제 LLM 호출 경로 연결
  - 규칙 기반 결과를 fallback으로 유지하고, LLM 결과에는 provider/model/prompt version/비용 추적 필드 저장
  - hallucination 방지를 위해 원문 링크 기반 근거만 사용하도록 출력 schema 제한
- 완료 기준:
  - LLM provider off 상태에서도 기존 규칙 기반 Job 정상 동작
  - LLM provider on 상태에서 생성 결과, 근거, 실패 fallback, 비용 로그 확인

### 시그널 품질 평가 체계

- 상태: Backlog
- 배경: 오늘의 시그널과 관심 브리핑이 제품 차별화의 핵심이므로 생성 품질을 운영자가 평가할 수 있어야 한다.
- 방향:
  - 어드민 인사이트 결과에 유용함/중복/오래됨/근거 부족 같은 평가 필드 추가
  - 푸시 후보가 실제 클릭/읽음으로 이어졌는지 이벤트 구조 검토
  - 평가 결과를 다음 Job ranking 또는 LLM prompt 개선에 반영
- 완료 기준:
  - 어드민에서 인사이트별 평가 저장
  - 평가/클릭/발송 결과를 날짜·타입·심볼별로 조회

### 알림 개인화 고도화

- 상태: Backlog
- 배경: 현재 알림 outbox는 범용 구조를 갖췄지만, 사용자별 관심종목/행동 기반 ranking은 제한적이다.
- 방향:
  - 관심종목, 최근 본 종목/뉴스, 알림 클릭/읽음 이력을 사용자별 signal로 저장
  - `insight_signal`, `market_alert`, `earnings_reminder`별 발송 우선순위 분리
  - 과도한 푸시를 막는 사용자별 frequency cap과 quiet hours 도입
- 완료 기준:
  - 같은 인사이트라도 사용자별 대상/우선순위가 다르게 계산됨
  - 어드민에서 왜 이 사용자에게 발송 후보가 되었는지 확인 가능

## Data / Infrastructure

### MySQL 전환 준비

- 상태: Backlog
- 배경: 현재는 SQLite 기능별 테이블로 운영하고, 문서상 추후 MySQL 전환 시 같은 테이블 경계를 유지하기로 했다.
- 방향:
  - `server/src/db`의 SQLite 직접 호출을 repository interface 뒤로 단계적으로 분리
  - SQLite schema와 MySQL DDL 간 타입/인덱스 차이 정리
  - Railway volume SQLite에서 managed MySQL로 옮길 migration/export 절차 설계
- 완료 기준:
  - 주요 도메인(news, youtube, quotes, insights, notifications, app users)이 DB adapter 교체 가능한 구조
  - 데이터 export/import rehearsal 문서화

### 사용자 관심종목 서버 동기화

- 상태: Backlog
- 배경: 관심종목은 현재 기기 저장 중심이고, 제품 로드맵에는 사용자별 관심종목 서버 동기화가 포함되어 있다.
- 방향:
  - 로그인 사용자 기준 watchlist 테이블 추가
  - 비로그인 기기 watchlist와 로그인 후 서버 watchlist 병합 정책 정의
  - 관심 브리핑, 알림 개인화, 종목 상세 추천에서 서버 watchlist 사용
- 완료 기준:
  - 기기 변경 후에도 로그인 계정의 관심종목이 복원됨
  - 알림 후보와 관심 브리핑이 서버 watchlist 기준으로 동작

### 포트폴리오 / 활동 기반 맞춤 브리핑

- 상태: Backlog
- 배경: PRD 확장 항목으로 포트폴리오/활동 기반 맞춤 브리핑이 남아 있다.
- 방향:
  - 단순 관심종목과 실제 보유/관심 강도를 구분할 데이터 모델 검토
  - 매수/매도 정보 없이도 “자주 보는 종목”, “알림 반응” 기반 개인화 가능성 검토
  - 민감한 투자 정보 저장 시 보안/약관/개인정보 처리 범위 검토
- 완료 기준:
  - 개인화 브리핑 MVP 범위와 저장 데이터 최소 범위 확정

## Content / Providers

### 유튜브 검색 품질 개선

- 상태: Backlog
- 배경: `domain/youtube/economy.ts`에 YouTube Data API `q` 조합과 `videoCategoryId` 병행 검토 메모가 남아 있다.
- 방향:
  - 경제 채널 큐레이션과 키워드 검색의 역할 분리
  - `videoCategoryId`, 조회수, 발행 시각, 중복 채널 제한 기준 실험
  - 최신순/인기순 버킷의 품질을 어드민에서 비교 가능하게 표시
- 완료 기준:
  - 인기순이 단순 최신순과 명확히 다르게 보임
  - 부적합 영상/중복 영상 비율이 줄어든 기준을 문서화

### 번역 도메인 확장

- 상태: Backlog
- 배경: 현재 번역 UX는 뉴스 중심이며, 문서에는 향후 유튜브/기타 콘텐츠 번역 확장 가능성이 남아 있다.
- 방향:
  - 번역 설정의 provider/locale 구조를 뉴스 외 콘텐츠에도 재사용 가능하게 점검
  - 유튜브 제목/설명, 컨콜 요약, 인사이트 요약 번역 필요 여부 분리
  - 자동 번역 실패/대기/mock 값 노출 방지 기준 공통화
- 완료 기준:
  - 콘텐츠 타입별 번역 대상 필드와 fallback 기준 문서화
  - 뉴스 외 한 개 도메인 이상에 같은 번역 구조 적용 가능

## Business / Release

### AdMob 운영 정책 결정

- 상태: Backlog
- 배경: 출시 체크리스트에 운영 광고 ID 적용 또는 광고 비노출 정책 결정이 남아 있다.
- 방향:
  - 초기 출시에서 광고를 켤지, 사용자 경험 안정화 후 켤지 결정
  - 운영 광고 ID, 테스트 ID, 개인정보/광고 식별자 문항 정리
  - 광고 위치가 핵심 정보 소비 흐름을 방해하지 않는지 QA
- 완료 기준:
  - App Store/Play Store 제출 전 광고 사용 여부와 정책 문서화

### 구독 / 프리미엄 구조 검토

- 상태: Backlog
- 배경: PRD 출시 후 로드맵에 구독/프리미엄 구조가 포함되어 있다.
- 방향:
  - 무료/프리미엄 차이를 원문 수집량이 아니라 시그널 품질, 알림 개인화, 고급 브리핑 중심으로 설계
  - App Store/Play Store 인앱결제 요구사항 확인
  - 유료 기능이 투자 조언으로 오해되지 않도록 문구/약관 검토
- 완료 기준:
  - 가격/기능/스토어 정책/약관 리스크를 포함한 MVP 구독안 작성
