import { useMemo, type ComponentProps } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { splitTextWithSymbolLinks } from '@/domain/etfInsights/linkSymbolsInText';
import { openEtfInsightSymbol } from '@/domain/etfInsights/openSymbol';
import { splitTextWithSignedChangeTints } from '@/domain/quotes/tintSignedChangeInText';
import { useQuoteChangeColors } from '@/hooks/useQuoteChangeColors';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  children: string;
  /** 본문에서 링크로 열 티커 목록 (테마 `etfs` 등) */
  linkSymbols?: string[] | null;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  tintWeight?: TextStyle['fontWeight'];
  linkWeight?: TextStyle['fontWeight'];
} & Omit<ComponentProps<typeof Text>, 'children' | 'style' | 'numberOfLines'>;

type RenderPart =
  | { key: string; kind: 'plain'; text: string }
  | { key: string; kind: 'up' | 'down'; text: string }
  | { key: string; kind: 'symbol'; text: string; symbol: string };

/**
 * 변동률 틴트 + 알려진 티커 탭 → Yahoo/Naver.
 * 티커가 본문에 있을 때만 링크 (별도 메타 행 불필요).
 */
export function SymbolLinkedTintedText({
  children,
  linkSymbols,
  style,
  numberOfLines,
  tintWeight = '600',
  linkWeight = '600',
  ...rest
}: Props) {
  const quoteChange = useQuoteChangeColors();
  const { theme } = useSignalTheme();

  const parts = useMemo((): RenderPart[] => {
    const symbolSegments = splitTextWithSymbolLinks(children, linkSymbols);
    const out: RenderPart[] = [];
    let index = 0;
    for (const seg of symbolSegments) {
      if (seg.kind === 'symbol') {
        out.push({
          key: `sym-${index++}`,
          kind: 'symbol',
          text: seg.text,
          symbol: seg.symbol,
        });
        continue;
      }
      for (const tint of splitTextWithSignedChangeTints(seg.text)) {
        out.push({
          key: `t-${index++}`,
          kind: tint.kind,
          text: tint.text,
        });
      }
    }
    return out;
  }, [children, linkSymbols]);

  const hasMark = parts.some((p) => p.kind !== 'plain');
  if (!hasMark) {
    return (
      <Text style={style} numberOfLines={numberOfLines} {...rest}>
        {children}
      </Text>
    );
  }

  return (
    <Text style={style} numberOfLines={numberOfLines} {...rest}>
      {parts.map((part) => {
        if (part.kind === 'plain') return part.text;
        if (part.kind === 'symbol') {
          return (
            <Text
              key={part.key}
              onPress={() => openEtfInsightSymbol(part.symbol)}
              accessibilityRole="link"
              style={{
                color: theme.green,
                fontWeight: linkWeight,
                textDecorationLine: 'underline',
              }}>
              {part.text}
            </Text>
          );
        }
        return (
          <Text
            key={part.key}
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
