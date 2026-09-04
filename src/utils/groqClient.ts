import { fetchWithKeyFailover } from './apiKeyManager';

export const GROQ_REASONING_MODELS = [
  'openai/gpt-oss-120b',
  'gpt-oss-120b',
  'openai/gpt-oss-20b',
  'gpt-oss-20b',
  'qwen/qwen3.8-27b',
  'qwen/qwen3.6-27b',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
];

export const GROQ_WHISPER_MODELS = [
  'whisper-large-v3-turbo',
  'whisper-large-v3',
];

let workingGroqModel: string | null = null;
let workingWhisperModel: string | null = null;

function isGroqModelError(status: number, body: string): boolean {
  if (status === 404 || status === 503 || status === 429) return true;
  return /model_not_found|does not exist|not have access|decommissioned|unavailable/i.test(body || '');
}

/**
 * Transcribes audio using Groq's whisper models with automatic fallback.
 */
export async function transcribeAudioWithGroq(audioBlob: Blob): Promise<any> {
  const models = workingWhisperModel
    ? [workingWhisperModel, ...GROQ_WHISPER_MODELS.filter((m) => m !== workingWhisperModel)]
    : GROQ_WHISPER_MODELS;

  let lastError = '';

  for (const model of models) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm'); // Ensure filename has an extension
    formData.append('model', model);
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'word');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetchWithKeyFailover(
        () => 'https://api.groq.com/openai/v1/audio/transcriptions',
        {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        },
        'groq'
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        workingWhisperModel = model;
        return await response.json();
      }

      const errorText = await response.text().catch(() => '');
      lastError = `${response.status} - ${errorText}`;
      if (isGroqModelError(response.status, errorText)) {
        console.warn(`[Groq Whisper] Model "${model}" unavailable (${response.status}). Trying next candidate...`);
        continue;
      }
      throw new Error(`Groq Whisper API error: ${response.status} - ${errorText}`);
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err?.name === 'AbortError') throw err;
      if (models.indexOf(model) === models.length - 1) throw err;
      console.warn(`[Groq Whisper] Error with model "${model}": ${err?.message}. Trying next candidate...`);
    }
  }

  throw new Error(`Groq Whisper API error: All candidate models failed. Last error: ${lastError}`);
}

/**
 * Reasoning using available Groq reasoning models with automatic candidate fallback.
 */
export async function analyzeReasoningWithGroq(prompt: string, systemPrompt?: string): Promise<string> {
  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const models = workingGroqModel
    ? [workingGroqModel, ...GROQ_REASONING_MODELS.filter((m) => m !== workingGroqModel)]
    : GROQ_REASONING_MODELS;

  let lastError = '';

  for (const model of models) {
    const payload = {
      model,
      messages,
      temperature: 0.2,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    try {
      const response = await fetchWithKeyFailover(
        () => 'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
        'groq'
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        workingGroqModel = model;
        const data = await response.json();
        return data?.choices?.[0]?.message?.content || '';
      }

      const errorText = await response.text().catch(() => '');
      lastError = `${response.status} - ${errorText}`;

      if (isGroqModelError(response.status, errorText)) {
        console.warn(`[Groq Reasoning] Model "${model}" failed (${response.status}): ${errorText.slice(0, 120)}. Falling back to next candidate...`);
        continue;
      }

      throw new Error(`Groq Reasoning API error: ${response.status} - ${errorText}`);
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err?.name === 'AbortError') throw err;
      if (models.indexOf(model) === models.length - 1) {
        throw new Error(lastError ? `Groq Reasoning API error: ${lastError}` : err.message);
      }
      console.warn(`[Groq Reasoning] Candidate "${model}" failed: ${err?.message}. Trying next candidate...`);
    }
  }

  throw new Error(`Groq Reasoning API error: All model candidates failed. Last error: ${lastError}`);
}
