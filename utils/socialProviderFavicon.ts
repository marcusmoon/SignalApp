import { googleFaviconIconUrl } from '@/constants/sourceIconUrls';
import type { SocialProviderKey } from '@/integrations/signal-api';

const SOCIAL_PROVIDER_FAVICON_DOMAIN: Readonly<Record<SocialProviderKey, string>> = {
  kakao: 'kakao.com',
  naver: 'naver.com',
  google: 'google.com',
  apple: 'apple.com',
};

/** My info 소셜 연동·로그인 버튼용 브랜드 파비콘 */
export function socialProviderFaviconUrl(provider: SocialProviderKey, size = 32): string {
  return googleFaviconIconUrl(SOCIAL_PROVIDER_FAVICON_DOMAIN[provider], size);
}
