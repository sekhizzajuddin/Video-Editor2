import { getEnvHuggingFaceKey, getLocalHuggingFaceKey } from './apiKeyManager';

export interface SfxCue {
  id?: string;
  start: number;
  end: number;
  query: string;
  options?: any[];
}

// AudioLDM2 is specifically designed for sound effects generation
const AUDIO_LDM2_MODEL = 'cvssp/audioldm2';

/**
 * Prepare generation requests for AudioLDM2 (one prompt per cue for best quality)
 */
function prepareGenerationRequests(cues: SfxCue[]): { cue: SfxCue; prompt: string; duration: number }[] {
  return cues.map(cue => {
    const durationSecs = Math.max(1, Math.min(15, Math.round(cue.end - cue.start)));
    // AudioLDM2 works best with descriptive prompts
    const prompt = `Sound effect: ${cue.query}, high quality, professional audio, ${durationSecs} seconds`;
    return { cue, prompt, duration: durationSecs };
  });
}

/**
 * Generate SFX using AudioLDM2 (specialized for sound effects)
 * Generates ONE clip per API call for maximum quality
 */
export async function generateCombinedSfx(
  allCues: SfxCue[],
  onProgress: (progress: number) => void
): Promise<Blob[]> {
  if (allCues.length === 0) return [];

  const requests = prepareGenerationRequests(allCues);
  const finalAudioBlobs: Blob[] = [];
  
  console.log(`[AudioLDM2] Generating ${requests.length} sound effects individually for best quality.`);

  for (let i = 0; i < requests.length; i++) {
    const { cue, prompt, duration } = requests[i];
    
    console.log(`[AudioLDM2] Generating cue ${i + 1}/${requests.length}: "${cue.query}"`);
    
    try {
      const audioBlob = await generateWithAudioLDM2(prompt, duration);
      finalAudioBlobs.push(audioBlob);
    } catch (err) {
      console.error(`[AudioLDM2] Cue ${i + 1} failed:`, err);
      // Return empty blob to maintain alignment
      finalAudioBlobs.push(new Blob([], { type: 'audio/wav' }));
    }
    
    onProgress(((i + 1) / requests.length) * 100);
  }

  return finalAudioBlobs;
}

/**
 * Call HuggingFace AudioLDM2 model for SFX generation
 */
async function generateWithAudioLDM2(prompt: string, duration: number): Promise<Blob> {
  const token = getLocalHuggingFaceKey() || getEnvHuggingFaceKey();
  
  if (!token) {
    throw new Error('HuggingFace API key missing. Add it in Settings.');
  }

  // AudioLDM2 endpoint - specialized for sound effects
  const response = await fetch(`https://api-inference.huggingface.co/models/${AUDIO_LDM2_MODEL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_length: duration,
        guidance_scale: 7.5, // Higher = more faithful to prompt
        negative_prompt: 'music, speech, voice, talking, noisy, low quality'
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AudioLDM2 failed: ${response.status} - ${errorText}`);
  }

  return await response.blob();
}