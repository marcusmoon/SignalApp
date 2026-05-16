# SIGNAL — Later Tasks

이 문서는 당장 작업 범위에서는 제외하지만, 이후 제품 품질과 운영성을 위해 다시 볼 항목을 관리한다.

## Mobile / Web

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
