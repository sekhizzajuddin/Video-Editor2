import { fetchWithKeyFailover } from './apiKeyManager';

/**
 * Transcribes audio using Groq's whisper-large-v3-turbo model.
 */
export async function transcribeAudioWithGroq(audioBlob: Blob): Promise<any> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm'); // Ensure filename has an extension
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  const response = await fetchWithKeyFailover(
    (key) => 'https://api.groq.com/openai/v1/audio/transcriptions',
    {
      method: 'POST',
      body: formData,
      signal: controller.signal
    },
    'groq'
  );

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq Whisper API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Basic reasoning using OpenAI GPT-OSS 120B on Groq.
 */
export async function analyzeReasoningWithGroq(prompt: string, systemPrompt?: string): Promise<string> {
  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const payload = {
    model: 'openai/gpt-oss-120b',
    messages,
    temperature: 0.2
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const response = await fetchWithKeyFailover(
    (key) => 'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    },
    'groq'
  );

  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq LLaMA API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
}
