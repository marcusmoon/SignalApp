import { useFocusEffect } from '@react-navigation/native';
import { type Dispatch, type SetStateAction, useCallback, useRef } from 'react';

/**
 * 탭 포커스/블러 시점에 **이미 목록이 있으면** `loading`을 false로 맞춘다.
 * 탭 전환·비동기 경합으로 `loading`만 true로 남아 본문이 가려지는 현상을 줄인다.
 *
 * 데이터 fetch 로직은 그대로 두고, 탭 화면에서 `setLoading` + `items` 배열만 넘기면 된다.
 */
export function useTabScreenLoadingRecovery<T>(
  items: readonly T[],
  setLoading: Dispatch<SetStateAction<boolean>>,
): void {
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useFocusEffect(
    useCallback(() => {
      const clearLoadingIfHasItems = () => {
        if (itemsRef.current.length > 0) {
          setLoading(false);
        }
      };
      clearLoadingIfHasItems();
      return clearLoadingIfHasItems;
    }, [setLoading]),
  );
}
