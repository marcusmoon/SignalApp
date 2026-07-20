import { useMemo, type ComponentProps, type ReactNode } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { splitTextWithSignedChangeTints } from '@/domain/quotes/tintSignedChangeInText';
import { useQuoteChangeColors } from '@/hooks/useQuoteChangeColors';

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** 본문 앞 인라인 prefix (예: 세션 태그) */
  prefix?: ReactNode;
  /** nested Text에 추가로 줄 강조(기본 semibold) */
  tintWeight?: TextStyle['fontWeight'];
} & Omit<ComponentProps<typeof Text>, 'children' | 'style' | 'numberOfLines'>;

/**
 * 본문 뷰잉 시 변동률(`+1.2%`, `-0.5%`, `2.78% 상승`, 근처 방향 힌트가 있는 `2.78%` 등)을
 * 설정 규칙(한/미) 색으로 칠한다.
 */
export function ChangeTintedText({
  children,
  style,
  numberOfLines,
  prefix,
  tintWeight = '600',
  ...rest
}: Props) {
  const quoteChange = useQuoteChangeColors();
  const segments = useMemo(() => splitTextWithSignedChangeTints(children), [children]);
  const hasTint = segments.some((part) => part.kind !== 'plain');

  if (!hasTint) {
    return (
      <Text style={style} numberOfLines={numberOfLines} {...rest}>
        {prefix}
        {children}
      </Text>
    );
  }

  return (
    <Text style={style} numberOfLines={numberOfLines} {...rest}>
      {prefix}
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
