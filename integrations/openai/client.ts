/**
 * OpenAI Chat Completions — **this file is the only place** in this integration that reads `env.openaiKey`
 * and sends it on the wire. Other modules use `postOpenAiChatCompletion` only.
 */
import { env } from '@/services/env';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

export function isOpenAiConfigured(): boolean {
  return env.openaiKey.length > 0;
}

export async function postOpenAiChatCompletion(
  system: string,
  user: string,
  maxTokens = 8192,
): Promise<string> {
  if (!isOpenAiConfigured()) throw new Error('OPENAI_KEY_MISSING');
  const res = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.openaiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
    }),
  });
  const rawText = await res.text();
  if (!res.ok) {
    if (__DEV__) {
      console.warn('[postOpenAiChatCompletion]', `status=${res.status}`, rawText.slice(0, 400));
    }
    throw new Error(`OpenAI ${res.status}: ${rawText.slice(0, 400)}`);
  }
  const data = JSON.parse(rawText) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? '';
}
