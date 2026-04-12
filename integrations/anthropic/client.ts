/**
 * Anthropic API — **this file is the only place** in this integration that reads `env.anthropicKey`
 * and attaches it to outbound requests. Higher layers call these helpers only.
 */
import { env } from '@/services/env';

const ANTHROPIC_VERSION = '2023-06-01';

export function isAnthropicConfigured(): boolean {
  return env.anthropicKey.length > 0;
}

type MsgContent = { type: 'text'; text: string };

export async function postAnthropicMessages(params: {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
}): Promise<string> {
  if (!isAnthropicConfigured()) throw new Error('ANTHROPIC_KEY_MISSING');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.anthropicKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: [{ role: 'user', content: [{ type: 'text', text: params.user } satisfies MsgContent] }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const block = data.content.find((c) => c.type === 'text');
  return block?.text ?? '';
}
