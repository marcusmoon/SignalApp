import { useEffect, useRef, useState } from 'react';

import { HomeFocusContent } from '@/components/signal/HomeFocusContent';
import { APP_WIDE_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import { SCREEN_WIDE_SCROLL_BOTTOM_BASE } from '@/constants/screenLayout';
import { useRollingLocalYmd } from '@/hooks/useRollingLocalYmd';

export function IpadHomeScreen() {
  const todayYmd = useRollingLocalYmd();
  const todayYmdRef = useRef(todayYmd);
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);

  useEffect(() => {
    const prevToday = todayYmdRef.current;
    todayYmdRef.current = todayYmd;
    setSelectedYmd((prev) => (prev === prevToday || prev > todayYmd ? todayYmd : prev));
  }, [todayYmd]);

  return (
    <HomeFocusContent
      selectedYmd={selectedYmd}
      todayYmd={todayYmd}
      onSelectedYmdChange={setSelectedYmd}
      scrollContentPaddingBottom={SCREEN_WIDE_SCROLL_BOTTOM_BASE}
      contentMaxWidth={APP_WIDE_CONTENT_MAX_WIDTH}
      showIssueSummary
    />
  );
}
