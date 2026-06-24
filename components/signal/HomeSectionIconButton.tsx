import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type HomeSectionIconButtonProps = {
  icon: ComponentProps<typeof FontAwesome5>['name'];
  accessibilityLabel: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  size?: number;
  solid?: boolean;
};

export function HomeSectionIconButton({
  icon,
  accessibilityLabel,
  onPress,
  style,
  size = 13,
  solid = true,
}: HomeSectionIconButtonProps) {
  const { theme } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed, style]}>
      <FontAwesome5 name={icon} size={size} color={theme.green} solid={solid} />
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    btn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    pressed: {
      opacity: 0.78,
    },
  });
}
