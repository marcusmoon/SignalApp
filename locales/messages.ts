import { en } from '@/locales/en';
import { ja } from '@/locales/ja';
import { ko, type MessageId } from '@/locales/ko';

/** Supported UI languages */
export type AppLocale = 'ko' | 'en' | 'ja';

/** Interpolate {{name}} in strings */
export function formatMessage(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
  }
  return out;
}

export const messages = {
  ko,
  en,
  ja,
} satisfies Record<AppLocale, Record<MessageId, string>>;

export type { MessageId };
