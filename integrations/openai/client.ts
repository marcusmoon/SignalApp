/**
 * OpenAI calls are server-side only. The app no longer reads or sends provider keys.
 */
export function isOpenAiConfigured(): boolean {
  return false;
}

export async function postOpenAiChatCompletion(
  system: string,
  user: string,
  maxTokens = 8192,
): Promise<string> {
  void system;
  void user;
  void maxTokens;
  throw new Error('SIGNAL_API_ONLY');
}
