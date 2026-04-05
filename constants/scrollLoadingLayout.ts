import type { ViewStyle } from 'react-native';

/** 로딩 시 ScrollView 콘텐츠가 뷰포트 높이까지 채워져 인디케이터를 세로 중앙에 둘 수 있게 함 */
export const SCROLL_CONTENT_LOADING_STYLE: ViewStyle = { flexGrow: 1 };

/**
 * ScrollView 내부 로딩 래퍼(`SignalLoadingIndicator` 등).
 * 고정 헤더는 화면(`topFixed`/`callsTop`)의 zIndex·overflow로 분리하고, 여기서는 스크롤 영역 안에서만 중앙 정렬.
 */
export const SCROLL_LOADING_BODY_STYLE: ViewStyle = {
  flexGrow: 1,
  minHeight: 200,
  justifyContent: 'center',
  alignItems: 'center',
  alignSelf: 'stretch',
  paddingVertical: 24,
};
