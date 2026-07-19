import { useEffect, useState } from 'react';

import {
  NEWS_UNREAD_CHECK_DEFAULT_MINUTES,
  loadNewsUnreadCheckIntervalMinutes,
  newsUnreadCheckIntervalMs,
  subscribeNewsUnreadCheckIntervalChanged,
} from '@/services/newsUnreadCheckIntervalPreference';

/**
 * 표시 설정의 「탭 새 글 확인」간격(ms).
 * 탭 배지 폴링과 화면 상단 chip 폴링이 공유한다.
 */
export function useFeedUnreadCheckIntervalMs(): number {
  const [ms, setMs] = useState(() =>
    newsUnreadCheckIntervalMs(NEWS_UNREAD_CHECK_DEFAULT_MINUTES),
  );

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      const minutes = await loadNewsUnreadCheckIntervalMinutes();
      if (!cancelled) setMs(newsUnreadCheckIntervalMs(minutes));
    };

    void sync();
    const unsubscribe = subscribeNewsUnreadCheckIntervalChanged(() => {
      void sync();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return ms;
}
