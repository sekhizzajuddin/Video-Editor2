import { getEnvElevenLabsKey, getLocalElevenLabsKey } from './apiKeyManager';

export interface SfxCue {
  id?: string;
  start: number;
  end: number;
  query: string;
  options?: any[];
}

const MAX_DURATION_PER_CALL = 29; // max 29s per call to be safe (API max is 30)

/**
 * Main API call to the Vercel proxy for ElevenLabs
 */
async function callElevenLabsProxy(text: string, duration: number): Promise<Blob> {
  const token = getLocalElevenLabsKey() || getEnvElevenLabsKey();
  
  if (!token) {
    throw new Error('ElevenLabs API key is missing. Please set it in Settings.');
  }

  const response = await fetch('/api/elevenlabs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      duration_seconds: duration,
      prompt_influence: 0.5, // Increased from 0.3 for better prompt adherence
      token
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs generation failed: ${response.status} - ${errorText}`);
  }

  return await response.blob();
}

/**
 * Handles SFX generation with ElevenLabs
 * Generates one clip per cue for better quality control
 */
export async function generateCombinedSfx(
  allCues: SfxCue[],
  onProgress: (progress: number) => void
): Promise<Blob[]> {
  if (allCues.length === 0) return [];

  const finalAudioBlobs: Blob[] = [];
  
  console.log(`[ElevenLabs] Generating ${allCues.length} sound effects.`);

  for (let i = 0; i < allCues.length; i++) {
    const cue = allCues[i];
    const durationSecs = Math.max(1, Math.min(29, Math.round(cue.end - cue.start)));
    
    // Enhanced prompt for better SFX generation
    const prompt = `${cue.query}, ${durationSecs} seconds long, high quality sound effect, professional audio`;
    
    console.log(`[ElevenLabs] Generating cue ${i + 1}/${allCues.length}: "${cue.query}"`);
    
    try {
      const audioBlob = await callElevenLabsProxy(prompt, durationSecs);
      finalAudioBlobs.push(audioBlob);
    } catch (err) {
      console.error(`[ElevenLabs] Cue ${i + 1} failed:`, err);
      // Push empty blob to maintain alignment
      finalAudioBlobs.push(new Blob([], { type: 'audio/wav' }));
    }
    
    onProgress(((i + 1) / allCues.length) * 100);
  }

  return finalAudioBlobs;
}