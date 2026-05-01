# SIGNAL — 현재 스냅샷

이 문서는 **과거 날짜별 이력**을 남기지 않고, **현재 버전의 기능/구조/운영 기준**만 유지합니다.

## 앱 (Client)

- **로케일**: `locales/*`에 UI 문자열을 모으고, 화면/도메인에서 재사용한다.
- **데이터 경로**: 피처 데이터 HTTP는 **`integrations/signal-api/`** 만 사용한다. 응답 메모리 캐시는 **`integrations/signal-api/cache/*`** (뉴스·캘린더·컨콜·유튜브 등). 시세 탭 등 일부 TTL·보조 캐시는 **`services/cache/`** 와 설정 화면의 캐시 초기화와 연동한다.
- **도메인**: 뉴스 규칙 `domain/news`, 시세·심볼 시드 `domain/quotes`(예: US 심볼), 유튜브 큐레이션·핸들 `domain/youtube`, 컨콜/캘린더/시그널 등은 각 `domain/<영역>` 배럴로만 참조한다.
- **뉴스 UI**: `components/signal/NewsCard` — 해시태그·「원문 보기」푸터, 상대 시각은 **경과 시간** 기준(방금 / N분·시간 전; 로컬 날짜 전환과 무관).
- **Signal 서버 선택**: `.env`의 `EXPO_PUBLIC_SIGNAL_API_BASE_URL`은 번들 기본값이며, 앱 설정에서 `bundle / dev / real / custom` endpoint를 저장해 런타임에 바꿀 수 있다.
- **컨콜**: `services/concalls` 흐름과 앱 언어 기준 메시지; 서버 `/v1/concalls` 조회. 캐시 키에 로케일 포함.
- **앱 내 provider 클라이언트**: Finnhub·YouTube Data·OpenAI·Claude·CoinGecko 등 **직접 HTTP 클라이언트 폴더는 사용하지 않는다**. 타입·호환은 필요 시 `types/`·`utils/` 등으로만 둔다.

## 서버 (API / Jobs)

- **스케줄(Jobs)**: 운영 액션은 어드민에서 수행하고, 실행/로그는 서버 데이터와 API를 통해 관리한다.
- **컨콜 Provider ID**: 컨콜 수집 provider와 seed 환경변수는 내부적으로 `ninjas` / `NINJAS_KEY`를 사용한다.
- **Financial Juice 뉴스**: RSS 제목의 `FinancialJuice:` 접두어는 수집·표시 단계에서 제거한다.
- **어드민 뉴스 목록**: 기본 날짜 범위는 최근 일주일로 두어 오늘 수집분이 없어도 최신 뉴스가 보이게 한다.
- **어드민 날짜 필터**: 뉴스와 Job 실행 로그의 `오늘/어제/기간` 필터는 어드민에서 선택한 시간대 기준 날짜로 적용한다.
- **어드민 대시보드**: 뉴스·캘린더·컨콜·유튜브·시세·코인별 저장 수, 마지막 데이터, 마지막 실행/성공, 최근 결과 건수와 품질 보조 지표를 한 화면에서 확인한다.
- **번역**: 로케일별 설정은 Provider 선택 중심이며, 실제 모델은 Provider 기본 모델을 따른다.
- **뉴스 해시태그**: 번역 provider는 `hashtags`를 반환할 수 있고, 서버는 자동/수동 태그를 뉴스 item에 저장해 `/v1/news`와 어드민 편집에 노출한다.

## 어드민 (Admin Console)

- **다국어(i18n)**: 정적 문자열은 `data-i18n`로, 동적 영역은 렌더링 시 `textFor`/`textForVars`로 처리한다.
- **언어 변경 반영**: 언어 변경 시 현재 화면의 동적 영역도 다시 렌더링/리로드되어야 한다.
- **뉴스 편집**: 목록은 원문 중심, 번역 확인/수정은 모달에서 `English(Original) / 한국어 / 日本語` 탭으로 처리한다.
- **사이드바 접기/펼치기**: 경계에 **투명 거터(gutter)**를 두고, hover 시 버튼을 노출한다(평소 숨김, 클릭 안정성 우선).

## UI/UX 기준 문서

- **단일 기준**: 어드민 UI/UX의 현행 기준은 `docs/SIGNAL-ADMIN-UIUX.md`를 따른다.
