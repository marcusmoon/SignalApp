import { useEffect, useRef, useState } from 'react';

import { HomeFocusContent } from '@/components/signal/HomeFocusContent';
import { APP_WIDE_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
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
      scrollContentPaddingBottom={32}
      contentMaxWidth={APP_WIDE_CONTENT_MAX_WIDTH}
      showIssueSummary
    />
  );
}
