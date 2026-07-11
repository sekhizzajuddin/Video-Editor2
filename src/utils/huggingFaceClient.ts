import { getEnvHuggingFaceKey, getLocalHuggingFaceKey } from './apiKeyManager';

export interface HFGenerateOptions {
  model?: string;
  maxRetries?: number;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function generateAudioHuggingFace(
  prompt: string,
  options?: HFGenerateOptions
): Promise<Blob> {
  const envKey = getEnvHuggingFaceKey();
  const localKey = getLocalHuggingFaceKey();
  const hfKey = localKey || envKey;

  if (!hfKey) {
    throw new Error('HuggingFace API key is missing. Please add it in Settings.');
  }

  // Default to audioldm2 for SFX (high quality)
  const model = options?.model || 'cvssp/audioldm2';
  const url = `https://api-inference.huggingface.co/models/${model}`;
  const maxRetries = options?.maxRetries ?? 5;

  const fetchOptions: RequestInit = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${hfKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt,
    }),
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, fetchOptions);

    if (response.ok) {
      const blob = await response.blob();
      if (blob.size < 1000) {
        // Sometimes HF returns a tiny error blob instead of audio
        const text = await blob.text();
        throw new Error(`HuggingFace returned invalid audio: ${text}`);
      }
      // Create a new Blob ensuring correct mime type
      return new Blob([blob], { type: blob.type || 'audio/flac' });
    }

    // Handle 503 — model is loading / cold start
    if (response.status === 503) {
      let waitTime = 20; // default 20s backoff
      try {
        const errorJson = await response.json();
        if (errorJson.estimated_time) {
          waitTime = Math.ceil(errorJson.estimated_time);
        }
      } catch {
        // response wasn't JSON; use default wait
      }

      if (attempt < maxRetries) {
        console.log(`[HuggingFace] Model loading, retrying in ${waitTime}s (attempt ${attempt + 1}/${maxRetries})...`);
        await wait(waitTime * 1000);
        continue;
      }
      lastError = new Error(`HuggingFace model is still loading after ${maxRetries} retries. Try again later.`);
      break;
    }

    // Handle 429 — rate limited
    if (response.status === 429) {
      if (attempt < maxRetries) {
        const backoff = Math.min(60, (attempt + 1) * 10); // 10s, 20s, 30s...
        console.log(`[HuggingFace] Rate limited, retrying in ${backoff}s...`);
        await wait(backoff * 1000);
        continue;
      }
    }

    // Other errors — don't retry
    let errorDetail = '';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.error || JSON.stringify(errorJson);
    } catch {
      errorDetail = response.statusText;
    }
    throw new Error(`HuggingFace API error (${response.status}): ${errorDetail}`);
  }

  throw lastError || new Error('HuggingFace generation failed after retries.');
}
