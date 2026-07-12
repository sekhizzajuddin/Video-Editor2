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

/**
 * DISABLED: HuggingFace API is unreliable in some regions (DNS resolution fails)
 * Use Freesound API instead for SFX generation
 */
export async function generateAudioHuggingFace(
  prompt: string,
  options?: HFGenerateOptions
): Promise<Blob> {
  throw new Error(
    'HuggingFace audio generation unavailable (DNS resolution failed). ' +
    'Please use Freesound integration for SFX generation instead.'
  );
}