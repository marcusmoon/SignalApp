import { Platform, RefreshControl, type RefreshControlProps } from 'react-native';

import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = Pick<RefreshControlProps, 'refreshing' | 'onRefresh' | 'enabled'>;

export function ThemedRefreshControl(props: Props) {
  const { theme } = useSignalTheme();
  return (
    <RefreshControl
      {...props}
      tintColor={theme.green}
      colors={[theme.green]}
      progressBackgroundColor={theme.bg}
      style={Platform.OS === 'android' ? { backgroundColor: theme.bg } : undefined}
    />
  );
}
