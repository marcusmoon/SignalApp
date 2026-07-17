import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { HomeFocusContent } from '@/components/signal/HomeFocusContent';
import { SCREEN_WIDE_SCROLL_BOTTOM_BASE } from '@/constants/screenLayout';
import { useRollingLocalYmd } from '@/hooks/useRollingLocalYmd';
import { useSafeSetRouteParams } from '@/utils/safeRouteParams';

function parseHomeDateParam(raw: string | string[] | undefined, todayYmd: string): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) && text <= todayYmd) return text;
  return todayYmd;
}

export function IpadHomeScreen() {
  const todayYmd = useRollingLocalYmd();
  const todayYmdRef = useRef(todayYmd);
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const setRouteParams = useSafeSetRouteParams();
  const [selectedYmd, setSelectedYmd] = useState(() => parseHomeDateParam(params.date, todayYmd));

  useEffect(() => {
    const fromUrl = parseHomeDateParam(params.date, todayYmd);
    setSelectedYmd((prev) => (prev === fromUrl ? prev : fromUrl));
  }, [params.date, todayYmd]);

  useEffect(() => {
    const prevToday = todayYmdRef.current;
    todayYmdRef.current = todayYmd;
    setSelectedYmd((prev) => (prev === prevToday || prev > todayYmd ? todayYmd : prev));
  }, [todayYmd]);

  useEffect(() => {
    const urlDate = parseHomeDateParam(params.date, todayYmd);
    if (selectedYmd === urlDate) return;
    setRouteParams({ date: selectedYmd });
  }, [params.date, selectedYmd, setRouteParams, todayYmd]);

  const onSelectedYmdChange = (ymd: string) => {
    setSelectedYmd(ymd);
  };

  return (
    <HomeFocusContent
      selectedYmd={selectedYmd}
      todayYmd={todayYmd}
      onSelectedYmdChange={onSelectedYmdChange}
      scrollContentPaddingBottom={SCREEN_WIDE_SCROLL_BOTTOM_BASE}
    />
  );
}
