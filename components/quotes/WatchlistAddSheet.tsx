import { useMemo } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { AppTheme } from '@/constants/theme';
import {
  BOTTOM_SHEET_BACKDROP_COLOR,
  BOTTOM_SHEET_MAX_HEIGHT,
} from '@/constants/bottomSheetLayout';
import { UI_RADIUS_SHEET } from '@/constants/uiCornerRadius';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  visible: boolean;
  value: string;
  onChangeText: (text: string) => void;
  onAdd: () => void | Promise<void>;
  onReset: () => void;
  onDismiss: () => void;
  bottomInset: number;
  adding?: boolean;
};

export function WatchlistAddSheet({
  visible,
  value,
  onChangeText,
  onAdd,
  onReset,
  onDismiss,
  bottomInset,
  adding = false,
}: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('filterSheetDismissA11y')}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(bottomInset, 16) + 12 }]}>
          <View style={styles.grab} />
          <Text style={styles.title}>{t('quotesAddWatchTitle')}</Text>
          <Text style={styles.hint}>{t('quotesAlertTickerFormatBody')}</Text>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={t('quotesPlaceholderTicker')}
            placeholderTextColor={theme.textDim}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!adding}
            style={styles.input}
            onSubmitEditing={() => void onAdd()}
            returnKeyType="done"
          />
          <Pressable
            onPress={() => void onAdd()}
            disabled={adding}
            style={({ pressed }) => [
              styles.addBtn,
              adding && styles.addBtnDisabled,
              pressed && !adding && styles.addBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: adding }}>
            {adding ? (
              <ActivityIndicator color={theme.green} size="small" />
            ) : (
              <Text style={styles.addBtnText}>{t('quotesAddButton')}</Text>
            )}
          </Pressable>
          <Pressable
            onPress={onReset}
            disabled={adding}
            style={({ pressed }) => [styles.resetBtn, pressed && !adding && styles.resetBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('settingsQuotesReset')}>
            <Text style={styles.resetBtnText}>{t('settingsQuotesReset')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: BOTTOM_SHEET_BACKDROP_COLOR,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.bg,
      borderTopLeftRadius: UI_RADIUS_SHEET,
      borderTopRightRadius: UI_RADIUS_SHEET,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: theme.border,
      paddingHorizontal: 16,
      maxHeight: BOTTOM_SHEET_MAX_HEIGHT,
    },
    grab: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      marginTop: 16,
      marginBottom: 16,
    },
    title: {
      fontSize: sf(17),
      fontWeight: '600',
      color: theme.text,
      marginBottom: 6,
    },
    hint: {
      fontSize: sf(12),
      lineHeight: sf(18),
      color: theme.textMuted,
      marginBottom: 14,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: sf(15),
      color: theme.text,
      backgroundColor: theme.card,
      marginBottom: 16,
    },
    addBtn: {
      minHeight: 46,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      marginBottom: 14,
    },
    addBtnPressed: { opacity: 0.9 },
    addBtnDisabled: { opacity: 0.7 },
    addBtnText: { fontSize: sf(15), fontWeight: '600', color: theme.green },
    resetBtn: {
      alignSelf: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    resetBtnPressed: { opacity: 0.75 },
    resetBtnText: { fontSize: sf(13), fontWeight: '700', color: theme.danger },
  });
}
