import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo } from 'react';
import { Pressable, Text } from 'react-native';

import {
  SelectionFilterSheet,
  selectionFilterRowStyles,
} from '@/components/signal/SelectionFilterSheet';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  visible: boolean;
  onDone: () => void;
  sources: string[];
  selected: string[];
  onToggle: (source: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  bottomInset: number;
};

export function NewsSourceFilterModal({
  visible,
  onDone,
  sources,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
  bottomInset,
}: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const rowStyles = useMemo(() => selectionFilterRowStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <SelectionFilterSheet
      visible={visible}
      title={t('feedNewsFilterTitle')}
      hint={t('feedNewsFilterSub')}
      onDone={onDone}
      bottomInset={bottomInset}
      toolbar={{
        sectionLabel: t('feedNewsFilterIncluded'),
        countLabel: t('filterSheetSelectedCount', { selected: selected.length, total: sources.length }),
        selectAllLabel: t('feedNewsFilterSelectAll'),
        clearAllLabel: t('feedNewsFilterClearAll'),
        onSelectAll,
        onClearAll,
      }}>
      {sources.map((source) => {
        const on = selected.includes(source);
        return (
          <Pressable
            key={source}
            onPress={() => onToggle(source)}
            style={[rowStyles.row, on && rowStyles.rowOn]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}>
            <FontAwesome
              name={on ? 'check-square' : 'square-o'}
              size={18}
              color={on ? theme.green : theme.textDim}
              style={rowStyles.checkIcon}
            />
            <Text style={[rowStyles.name, !on && rowStyles.nameOff]} numberOfLines={2}>
              {source}
            </Text>
          </Pressable>
        );
      })}
    </SelectionFilterSheet>
  );
}
