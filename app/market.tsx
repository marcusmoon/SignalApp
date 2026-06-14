import { Redirect } from 'expo-router';

/** 시장 요약은 시장 브리핑 허브로 통합되었습니다. */
export default function MarketRedirectScreen() {
  return <Redirect href="/briefing" />;
}
