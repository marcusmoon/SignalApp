import { Redirect } from 'expo-router';

/** 시장 요약은 관심 브리핑 화면 상단으로 통합되었습니다. */
export default function MarketRedirectScreen() {
  return <Redirect href="/briefing" />;
}
