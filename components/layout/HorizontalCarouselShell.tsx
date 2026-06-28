import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  pageIndex: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Show prev/next on wide layout (desktop web + iPad). Defaults true. */
  showArrows?: boolean;
};

/** Wraps a horizontal ScrollView with overlay ‹ › controls on iPad / desktop web. */
export function HorizontalCarouselShell({
  pageIndex,
  pageCount,
  onPrev,
  onNext,
  children,
  footer,
  showArrows = true,
}: Props) {
  const { theme } = useSignalTheme();
  const { isWideLayout } = useResponsiveLayout();
  const styles = makeStyles(theme);

  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pageCount - 1;
  const arrowsVisible = showArrows && isWideLayout && pageCount > 1;

  return (
    <View style={styles.container}>
      <View style={styles.track}>
        {children}
        {arrowsVisible && canPrev ? (
          <Pressable
            onPress={onPrev}
            style={({ pressed }) => [styles.arrow, styles.arrowLeft, pressed && styles.arrowPressed]}
            accessibilityRole="button"
            accessibilityLabel="Previous">
            <FontAwesome name="chevron-left" size={13} color={theme.text} />
          </Pressable>
        ) : null}
        {arrowsVisible && canNext ? (
          <Pressable
            onPress={onNext}
            style={({ pressed }) => [styles.arrow, styles.arrowRight, pressed && styles.arrowPressed]}
            accessibilityRole="button"
            accessibilityLabel="Next">
            <FontAwesome name="chevron-right" size={13} color={theme.text} />
          </Pressable>
        ) : null}
      </View>
      {footer}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: 10,
    },
    track: {
      position: 'relative',
    },
    arrow: {
      position: 'absolute',
      top: '50%',
      width: 36,
      height: 36,
      marginTop: -18,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      zIndex: 3,
      shadowColor: '#000000',
      shadowOpacity: 0.18,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    arrowLeft: {
      left: 6,
    },
    arrowRight: {
      right: 6,
    },
    arrowPressed: {
      opacity: 0.82,
    },
  });
}
