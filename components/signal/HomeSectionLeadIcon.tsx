import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { useSignalTheme } from '@/contexts/SignalThemeContext';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  name: IconName;
};

/** Home section title lead — matches Trend (`trending-up-outline`) tone. */
export function HomeSectionLeadIcon({ name }: Props) {
  const { theme } = useSignalTheme();
  return (
      <Ionicons name={name} size={18} color={theme.green} accessibilityElementsHidden />
  );
}
