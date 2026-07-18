import { useMemo, type ComponentProps } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { splitTextWithEntityLinks } from '@/domain/entities/linkEntitiesInText';
import { openFinanceSymbol } from '@/domain/quotes/openFinanceSymbol';
import { splitTextWithSignedChangeTints } from '@/domain/quotes/tintSignedChangeInText';
import { useQuoteChangeColors } from '@/hooks/useQuoteChangeColors';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { SignalApiBodyEntity } from '@/integrations/signal-api/types';

type Props = {
  children: string;
  /** ingest entities — name 매칭 시 국내 Naver / 해외 Yahoo */
  entities?: SignalApiBodyEntity[] | null;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  tintWeight?: TextStyle['fontWeight'];
  linkWeight?: TextStyle['fontWeight'];
} & Omit<ComponentProps<typeof Text>, 'children' | 'style' | 'numberOfLines'>;

type RenderPart =
  | { key: string; kind: 'plain'; text: string }
  | { key: string; kind: 'up' | 'down'; text: string }
  | { key: string; kind: 'entity'; text: string; symbol: string };

/**
 * 변동률 틴트 + ingest entities name 탭 → 국내 Naver / 해외 Yahoo.
 */
export function EntityLinkedTintedText({
  children,
  entities,
  style,
  numberOfLines,
  tintWeight = '600',
  linkWeight = '600',
  ...rest
}: Props) {
  const quoteChange = useQuoteChangeColors();
  const { theme } = useSignalTheme();

  const parts = useMemo((): RenderPart[] => {
    const entitySegments = splitTextWithEntityLinks(children, entities);
    const out: RenderPart[] = [];
    let index = 0;
    for (const seg of entitySegments) {
      if (seg.kind === 'entity') {
        out.push({
          key: `ent-${index++}`,
          kind: 'entity',
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
  }, [children, entities]);

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
        if (part.kind === 'entity') {
          return (
            <Text
              key={part.key}
              onPress={() => openFinanceSymbol(part.symbol)}
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
