import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';

/**
 * 탭을 벗어날 때 네이티브 `RefreshControl` UI는 접혀도 `refreshing` state가 `true`로 남는 경우가 있어,
 * 복귀 시 스피너가 멈춘 것처럼 보이는 현상을 막는다.
 */
export function useResetRefreshingOnTabBlur(
  setRefreshing: Dispatch<SetStateAction<boolean>>,
): void {
  useFocusEffect(
    useCallback(() => {
      return () => setRefreshing(false);
    }, [setRefreshing]),
  );
}
