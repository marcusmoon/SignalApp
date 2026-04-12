# SIGNAL — 레이어 기준 (1.0)

**Domain** = 제품 규칙만. `fetch`·벤더 키·URL 조립 없음.  
**Infrastructure** = HTTP/SDK·토큰·OS 어댑터.

## 디렉터리

| 경로 | 역할 |
|------|------|
| `integrations/<vendor>/` | `client.ts`만 키·아웃바운드 요청. 나머지는 client·캐시·DTO. |
| `domain/` | 순수 규칙·분류 (`news/*`, `concalls/*`, `youtube/*`, `quotes/ticker·segmentOrder·listLimits`, `theme/colorHex`, `calendar/eventTypeFilter`, `moreHub/order` 등). |
| `services/` | AsyncStorage·설정, 여러 모듈을 묶는 오케스트레이션, integration re-export. |
| `app/` | expo-router 화면. |
| `components/` | UI. 판단이 두꺼우면 `domain`으로. |
| `utils/` | 날짜·링크·플랫폼 헬퍼 등 공통 유틸 (`openYoutube` 포함). |
| `constants/` · `locales/` · `contexts/` | 정적 값, i18n, React Context. |

자세한 명령·환경 변수·탭별 연결은 **[AGENTS.md](./AGENTS.md)** 를 본다.
