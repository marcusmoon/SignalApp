import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

type Props = {
  pageIndex: number;
  pageCount: number;
  onPrev?: () => void;
  onNext?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Kept for compatibility. Carousel controls are intentionally gesture-first. */
  showArrows?: boolean;
  /** Keep arrows available at edges; caller handles wrap behavior. */
  loop?: boolean;
};

/** Wraps a horizontal ScrollView; movement is gesture-first and progress is shown by caller footer. */
export function HorizontalCarouselShell({
  children,
  footer,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.track}>{children}</View>
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  track: {
    position: 'relative',
  },
});
