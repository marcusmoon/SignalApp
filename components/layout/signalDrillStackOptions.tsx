import { PhoneHeaderBackButton } from '@/components/layout/PhoneHeaderBackButton';

type Args = {
  /** 허브·섹션명. 비우면 chevron만 있는 Stack 헤더 */
  title?: string;
  onBack: () => void;
};

/**
 * 홈·More 등 root Stack 드릴인 공통 헤더 옵션.
 * 숏컷 / 뉴스·섹터 흐름 상세 / 리스트 허브가 동일 chrome을 쓰도록 한다.
 */
export function signalDrillStackOptions({ title, onBack }: Args) {
  return {
    title: String(title ?? '').trim(),
    headerBackVisible: false as const,
    headerLeft: () => <PhoneHeaderBackButton onPress={onBack} />,
  };
}
