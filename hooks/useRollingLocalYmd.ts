import { useFocusEffect } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { todayLocalYmd } from '@/utils/date';

/** Local calendar YMD that refreshes on focus and when the app becomes active (midnight rollover). */
export function useRollingLocalYmd(): string {
  const [ymd, setYmd] = useState(() => todayLocalYmd());
  const ref = useRef(ymd);

  const refresh = useCallback(() => {
    const latest = todayLocalYmd();
    if (latest === ref.current) return;
    ref.current = latest;
    setYmd(latest);
  }, []);

  useEffect(() => {
    ref.current = ymd;
  }, [ymd]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return ymd;
}
