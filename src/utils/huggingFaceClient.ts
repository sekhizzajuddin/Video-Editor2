import { getEnvHuggingFaceKey, getLocalHuggingFaceKey } from './apiKeyManager';

export interface HFGenerateOptions {
  model?: string;
  maxRetries?: number;
}

// Available models for SFX generation — ordered by reliability on the free tier
export const HF_AUDIO_MODELS = [
  { id: 'facebook/musicgen-small', name: 'MusicGen Small (Recommended)', description: 'Fast & reliable, good for SFX and ambient' },
  { id: 'facebook/musicgen-medium', name: 'MusicGen Medium', description: 'Higher quality, slower cold start' },
  { id: 'cvssp/audioldm2', name: 'AudioLDM2 (Requires API Key)', description: 'Best quality but needs HuggingFace API key' },
];

export const DEFAULT_HF_MODEL = 'facebook/musicgen-small';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function generateAudioHuggingFace(
  prompt: string,
  options?: HFGenerateOptions
): Promise<Blob> {
  const envKey = getEnvHuggingFaceKey();
  const localKey = getLocalHuggingFaceKey();
  const hfKey = localKey || envKey;

  const model = options?.model || DEFAULT_HF_MODEL;
  // Point to the serverless Edge API proxy endpoint which resolves DNS on Vercel/Vite server side, bypassing client CORS & DNS blocks.
  const url = `/api/huggingface?model=${encodeURIComponent(model)}`;
  const maxRetries = options?.maxRetries ?? 8;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (hfKey) {
    headers['Authorization'] = `Bearer ${hfKey}`;
  }

  const fetchOptions: RequestInit = {
    method: 'POST',
    headers,
    body: JSON.stringify({
      inputs: prompt,
      options: { wait_for_model: false },
    }),
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response;
    
    try {
      response = await fetch(url, fetchOptions);
    } catch (networkErr: any) {
      console.error(`[HuggingFace] Network request failed:`, networkErr);
      throw new Error(`Network Error: Cannot reach the local proxy endpoint. Check your connection.`);
    }

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

    // Handle 503 (model loading) or 502 (proxy upstream error) — retry with backoff
    if (response.status === 503 || response.status === 502) {
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
        console.log(`[HuggingFace] Model loading/upstream error (${response.status}), retrying in ${waitTime}s (attempt ${attempt + 1}/${maxRetries})...`);
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
      errorDetail = errorJson.details 
        ? `${errorJson.error || 'Proxy Error'}: ${errorJson.details}`
        : (errorJson.error || JSON.stringify(errorJson));
    } catch {
      errorDetail = response.statusText;
    }
    throw new Error(`HuggingFace API error (${response.status}): ${errorDetail}`);
  }

  throw lastError || new Error('HuggingFace generation failed after retries.');
}