import { useMemo, type ComponentProps } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { splitTextWithSignedChangeTints } from '@/domain/quotes/tintSignedChangeInText';
import { useQuoteChangeColors } from '@/hooks/useQuoteChangeColors';

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** nested Text에 추가로 줄 강조(기본 semibold) */
  tintWeight?: TextStyle['fontWeight'];
} & Omit<ComponentProps<typeof Text>, 'children' | 'style' | 'numberOfLines'>;

/**
 * 본문 뷰잉 시 `+1.2%` / `-0.5%` 등 부호 있는 변동률만 설정 규칙(한/미) 색으로 칠한다.
 */
export function ChangeTintedText({
  children,
  style,
  numberOfLines,
  tintWeight = '600',
  ...rest
}: Props) {
  const quoteChange = useQuoteChangeColors();
  const segments = useMemo(() => splitTextWithSignedChangeTints(children), [children]);
  const hasTint = segments.some((part) => part.kind !== 'plain');

  if (!hasTint) {
    return (
      <Text style={style} numberOfLines={numberOfLines} {...rest}>
        {children}
      </Text>
    );
  }

  return (
    <Text style={style} numberOfLines={numberOfLines} {...rest}>
      {segments.map((part, index) => {
        if (part.kind === 'plain') return part.text;
        return (
          <Text
            key={`${part.kind}-${index}`}
            style={{
              color: part.kind === 'up' ? quoteChange.colors.up : quoteChange.colors.down,
              fontWeight: tintWeight,
            }}>
            {part.text}
          </Text>
        );
      })}
    </Text>
  );
}
