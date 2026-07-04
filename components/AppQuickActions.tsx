import { useEffect } from 'react';

import { useLocale } from '@/contexts/LocaleContext';
import { syncAppQuickActions } from '@/services/quickActions';
import { useQuickActionRouting } from 'expo-quick-actions/router';

/** 홈 화면 아이콘 길게 누르기 Quick Actions 등록 및 딥링크 라우팅 */
export function AppQuickActions() {
  const { t, locale } = useLocale();

  useQuickActionRouting();

  useEffect(() => {
    void syncAppQuickActions(t);
  }, [t, locale]);

  return null;
}
