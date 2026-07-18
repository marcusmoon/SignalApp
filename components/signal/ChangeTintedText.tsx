import type { ComponentProps } from 'react';

import { EntityLinkedTintedText } from '@/components/signal/EntityLinkedTintedText';

type Props = Omit<ComponentProps<typeof EntityLinkedTintedText>, 'entities'>;

/**
 * 본문 변동률 틴트 전용 별칭.
 * entity 링크가 필요하면 `EntityLinkedTintedText`에 `entities`를 넘긴다.
 */
export function ChangeTintedText(props: Props) {
  return <EntityLinkedTintedText {...props} />;
}
