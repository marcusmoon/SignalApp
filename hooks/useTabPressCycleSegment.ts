import { useEffect } from 'react';
import { useNavigation } from 'expo-router/react-navigation';

/**
 * 이미 포커스된 탭을 다시 누르면 상단 세그먼트를 순서대로 넘깁니다.
 */
export function useTabPressCycleSegment<T extends string>(
  segment: T | null | undefined,
  segmentOrder: readonly T[],
  onSelect: (next: T) => void,
) {
  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = (navigation as { addListener: (event: 'tabPress', callback: () => void) => () => void }).addListener(
      'tabPress',
      () => {
        if (!navigation.isFocused()) return;
        if (!segment || segmentOrder.length < 2) return;
        const idx = segmentOrder.indexOf(segment);
        if (idx < 0) return;
        const next = segmentOrder[(idx + 1) % segmentOrder.length];
        if (next === segment) return;
        onSelect(next);
      },
    );
    return unsubscribe;
  }, [navigation, onSelect, segment, segmentOrder]);
}
