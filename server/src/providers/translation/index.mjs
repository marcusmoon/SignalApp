import { config } from '../../config.mjs';
import { getProviderSetting } from '../../providerSettings.mjs';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

function localeLabel(locale) {
  if (locale === 'en') return 'English';
  if (locale === 'ja') return 'Japanese';
  return 'Korean';
}

function mockTranslateText(text, locale) {
  if (!text) return '';
  return text;
}

function stripJsonFence(text) {
  return String(text || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
}

function parseTranslationJson(text) {
  const parsed = JSON.parse(stripJsonFence(text));
  return {
    title: String(parsed.title || '').trim(),
    summary: String(parsed.summary || '').trim(),
    content: String(parsed.content || '').trim(),
  };
}

function buildNewsTranslationPrompt(newsItem, locale) {
  const target = localeLabel(locale);
  const source = newsItem.sourceName ? `Source: ${newsItem.sourceName}\n` : '';
  const system =
    `You translate financial news for Korean retail investors using the SIGNAL app. ` +
    `Translate into natural concise ${target}. Keep company names, tickers, numbers, and quoted facts accurate. ` +
    `Do not add analysis, advice, or facts not present in the source. ` +
    `Return ONLY valid JSON with keys "title", "summary", and "content".`;
  const user =
    `${source}` +
    `Title: ${newsItem.titleOriginal || ''}\n` +
    `Summary: ${newsItem.summaryOriginal || ''}\n` +
    `Content: ${newsItem.contentOriginal || ''}`;
  return { system, user };
}

async function translateWithOpenAI(newsItem, locale, model) {
  const setting = await getProviderSetting('openai');
  if (!setting.enabled) throw new Error('OPENAI_PROVIDER_DISABLED');
  if (!setting.apiKey) throw new Error('OPENAI_API_KEY_MISSING');
  const selectedModel = model || setting.defaultModel || 'gpt-4o-mini';
  const { system, user } = buildNewsTranslationPrompt(newsItem, locale);
  const res = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${setting.apiKey}`,
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 900,
      temperature: 0.2,
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${raw.slice(0, 400)}`);
  const data = JSON.parse(raw);
  const content = data.choices?.[0]?.message?.content ?? '';
  const translated = parseTranslationJson(content);
  return { ...translated, provider: 'openai', model: selectedModel };
}

async function translateWithClaude(newsItem, locale, model) {
  const setting = await getProviderSetting('claude');
  if (!setting.enabled) throw new Error('CLAUDE_PROVIDER_DISABLED');
  if (!setting.apiKey) throw new Error('ANTHROPIC_API_KEY_MISSING');
  const selectedModel = model || setting.defaultModel || 'claude-3-5-haiku-latest';
  const { system, user } = buildNewsTranslationPrompt(newsItem, locale);
  const res = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': setting.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: selectedModel,
      max_tokens: 900,
      temperature: 0.2,
      system,
      messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${raw.slice(0, 400)}`);
  const data = JSON.parse(raw);
  const content = data.content?.find?.((part) => part.type === 'text')?.text ?? '';
  const translated = parseTranslationJson(content);
  return { ...translated, provider: 'claude', model: selectedModel };
}

export async function translateNews({ newsItem, locale, provider, model }) {
  const selectedProvider = provider || config.translationProvider;
  const selectedModel = model || config.translationModel;

  if (locale === 'en') {
    return {
      locale,
      provider: 'original',
      model: 'source',
      status: 'completed',
      title: newsItem.titleOriginal || '',
      summary: newsItem.summaryOriginal || '',
      content: newsItem.contentOriginal || '',
      errorMessage: null,
      translatedAt: new Date().toISOString(),
    };
  }

  let translated;
  if (selectedProvider === 'openai') {
    translated = await translateWithOpenAI(newsItem, locale, selectedModel);
  } else if (selectedProvider === 'claude') {
    translated = await translateWithClaude(newsItem, locale, selectedModel);
  } else if (selectedProvider === 'mock') {
    translated = {
      provider: selectedProvider,
      model: selectedModel,
      title: mockTranslateText(newsItem.titleOriginal, locale),
      summary: mockTranslateText(newsItem.summaryOriginal, locale),
      content: mockTranslateText(newsItem.contentOriginal, locale),
    };
  } else {
    throw new Error(`TRANSLATION_PROVIDER_NOT_IMPLEMENTED:${selectedProvider}`);
  }

  return {
    locale,
    provider: translated.provider,
    model: translated.model,
    status: 'completed',
    title: translated.title || newsItem.titleOriginal || '',
    summary: translated.summary || newsItem.summaryOriginal || '',
    content: translated.content || newsItem.contentOriginal || '',
    errorMessage: null,
    translatedAt: new Date().toISOString(),
  };
}
