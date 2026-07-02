import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HomeFocusContent } from '@/components/signal/HomeFocusContent';
import { APP_WIDE_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useRollingLocalYmd } from '@/hooks/useRollingLocalYmd';

type IpadHomeScreenProps = {
  showHeading?: boolean;
};

export function IpadHomeScreen({ showHeading = true }: IpadHomeScreenProps) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const todayYmd = useRollingLocalYmd();
  const todayYmdRef = useRef(todayYmd);
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);

  useEffect(() => {
    const prevToday = todayYmdRef.current;
    todayYmdRef.current = todayYmd;
    setSelectedYmd((prev) => (prev === prevToday || prev > todayYmd ? todayYmd : prev));
  }, [todayYmd]);

  return (
    <HomeFocusContent
      selectedYmd={selectedYmd}
      todayYmd={todayYmd}
      onSelectedYmdChange={setSelectedYmd}
      scrollContentPaddingBottom={32}
      contentMaxWidth={APP_WIDE_CONTENT_MAX_WIDTH}
      showIssueSummary
      headerAccessory={
        showHeading ? (
          <View style={styles.focusHeading}>
            <Text style={styles.pageTitle}>{t('ipadHomeTitle')}</Text>
          </View>
        ) : undefined
      }
    />
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    focusHeading: {
      alignItems: 'center',
      paddingTop: 4,
      paddingBottom: 2,
    },
    pageTitle: {
      fontSize: sf(24),
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.4,
      textAlign: 'center',
    },
  });
}
