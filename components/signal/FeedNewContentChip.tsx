import { FeedUpdatePromptPill } from '@/components/signal/UpdatePromptStrip';

type FeedNewContentChipProps = {
  visible: boolean;
  refreshing?: boolean;
  message: string;
  onPress: () => void;
};

/** 백그라운드 폴링으로 새 콘텐츠가 있을 때 피드 상단(리스트 위)에 두는 chip */
export function FeedNewContentChip({ visible, refreshing, message, onPress }: FeedNewContentChipProps) {
  if (!visible || refreshing) return null;

  return <FeedUpdatePromptPill message={message} onPress={onPress} />;
}
