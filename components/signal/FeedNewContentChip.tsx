import { FeedUpdatePromptPill } from '@/components/signal/UpdatePromptStrip';

type FeedNewContentChipProps = {
  visible: boolean;
  refreshing?: boolean;
  message: string;
  onPress: () => void;
};

/** 백그라운드 폴링 새 소식 — 리스트 위 compact pill (OTA 풀폭 카드와 구분) */
export function FeedNewContentChip({ visible, refreshing, message, onPress }: FeedNewContentChipProps) {
  if (!visible || refreshing) return null;

  return <FeedUpdatePromptPill message={message} onPress={onPress} />;
}
