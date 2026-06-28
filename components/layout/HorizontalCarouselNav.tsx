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
  /** Show prev/next on wide layout (desktop web + iPad). Defaults true. */
  showArrows?: boolean;
  children?: ReactNode;
};

export function HorizontalCarouselNav({
  pageIndex,
  pageCount,
  onPrev,
  onNext,
  showArrows = true,
  children,
}: Props) {
  const { theme } = useSignalTheme();
  const { isWideLayout } = useResponsiveLayout();
  const styles = makeStyles(theme);

  if (pageCount <= 1) return children ? <>{children}</> : null;

  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pageCount - 1;
  const arrowsVisible = showArrows && isWideLayout;

  return (
    <View style={styles.row}>
      {arrowsVisible ? (
        <Pressable
          onPress={onPrev}
          disabled={!canPrev}
          style={({ pressed }) => [styles.arrowBtn, !canPrev && styles.arrowBtnDisabled, pressed && canPrev && styles.arrowBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Previous">
          <FontAwesome name="chevron-left" size={12} color={canPrev ? theme.text : theme.textDim} />
        </Pressable>
      ) : null}

      {children ? <View style={styles.center}>{children}</View> : null}

      {arrowsVisible ? (
        <Pressable
          onPress={onNext}
          disabled={!canNext}
          style={({ pressed }) => [styles.arrowBtn, !canNext && styles.arrowBtnDisabled, pressed && canNext && styles.arrowBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Next">
          <FontAwesome name="chevron-right" size={12} color={canNext ? theme.text : theme.textDim} />
        </Pressable>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 10,
    },
    center: {
      flexShrink: 1,
    },
    arrowBtn: {
      width: 32,
      height: 32,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    arrowBtnDisabled: {
      opacity: 0.45,
    },
    arrowBtnPressed: {
      opacity: 0.82,
    },
  });
}
