import { Redirect, type Href } from 'expo-router';

/** Today's briefing은 홈 탭으로 통합되었습니다. */
export default function TodayBriefingRedirect() {
  return <Redirect href={'/home' as Href} />;
}
