# SIGNAL — PRD (1.0)

**앱:** SIGNAL — *노이즈는 걸러내고, 진짜 시그널만*  
**타깃:** 미국 시장 관심 한국 개인 투자자  
**플랫폼:** iOS · Android (Expo SDK 54 / React Native 0.81)  
**수익:** AdMob + (로드맵) 프리미엄 구독

## 문제

영문 속보·실적 정보를 빠르게 한국어 맥락으로 받기 어렵다. SIGNAL은 **큐레이션 + 선택적 AI 번역/요약**으로 노이즈를 줄인다.

## 현재 제품 (1.0 범위)

| 영역 | 요약 |
|------|------|
| 뉴스 | 글로벌·코인·한국 세그먼트, 서버 수집 소스·해시태그, 한국은 키워드 필터, 서버 번역 설정 시 **제목 번역** |
| 시세 | 관심·인기·시총·코인 — 시세·시장 데이터는 **Signal Server API** 경유 |
| 컨콜 | 트랜스크립트 기반 요약(제공자·캐시 정책은 앱 설정 따름) |
| 캘린더 | 실적·이벤트, 로컬 알림 연동 |
| 유튜브 | 채널 큐레이션, 경제 키워드 검색 보조 |
| 설정 | 뉴스/시세 탭 순서, 한국 키워드, 해시태그 표시 개수, Signal 서버 endpoint, 테마·글래스, 알림 등 |

## UX 원칙

정보 밀도는 낮게, 로딩 체감은 짧게, 다크 모드 기본. AI 사용 시 출처·원문 링크를 유지한다.

## 기술 (요약)

- **스택:** Expo Router, TypeScript strict, 경로 별칭 `@/*`.
- **데이터:** 앱은 Signal Server API만 조회하고, Finnhub·YouTube Data API·Anthropic/OpenAI·CoinGecko 등 외부 provider는 서버/Admin에서 관리한다. 비즈니스 규칙은 **`domain/`**, 기기·설정은 **`services/`**.
- **보안:** 클라이언트 공개 env에는 Signal API 주소와 광고/개발 플래그만 둔다.

## 로드맵 (개략)

| 단계 | 방향 |
|------|------|
| 이후 | 모닝 브리핑, 종목별 뉴스 강화, 푸시·계정·구독 고도화 |

성공 지표·AdMob 상세·법무 문구는 필요 시 별도 기획 문서로 보강한다.

## 개발 진입

| 문서 | 용도 |
|------|------|
| [docs/AGENTS.md](./AGENTS.md) | 실행·환경 변수·디렉터리·탭별 파일 연결 |
| [docs/ARCHITECTURE.md](./ARCHITECTURE.md) | Domain / integrations / constants / hooks 레이어 규칙 |
| [docs/CHANGELOG.md](./CHANGELOG.md) | 현재 운영/구조 스냅샷 (히스토리 없음) |
