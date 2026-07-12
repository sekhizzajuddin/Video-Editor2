import { getEnvElevenLabsKey, getLocalElevenLabsKey } from './apiKeyManager';
import { splitAudioBySilence } from './audioSplitter';

export interface SfxCue {
  id?: string;
  start: number;
  end: number;
  query: string;
  options?: any[];
}

const MAX_DURATION_PER_CALL = 29; // max 29s per call to be safe (API max is 30)

interface Chunk {
  cues: SfxCue[];
  prompt: string;
  duration: number;
}

/**
 * Helper to group cues into credit-optimized chunks
 */
function chunkCues(cues: SfxCue[]): Chunk[] {
  const chunks: Chunk[] = [];
  let currentCues: SfxCue[] = [];
  let currentDuration = 0;
  
  const prefix = "A sequence of distinct sound effects separated by 1 second of silence: ";
  let currentPromptParts: string[] = [];

  const getEstimatedPrompt = (parts: string[]) => {
    return prefix + parts.map((part, idx) => `${idx + 1}) ${part}`).join(', ');
  };

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const cueDuration = Math.max(1, Math.min(29, Math.round(cue.end - cue.start)));
    
    // Clean up query: remove trailing/leading whitespace and formatting punctuation
    const cleanQuery = cue.query.trim().replace(/[.,;:]/g, '');
    const newPart = `${cleanQuery} for ${cueDuration} seconds`;
    
    // Add 1s silence between cues if we already have cues in this chunk
    const additionalDuration = currentCues.length > 0 ? (cueDuration + 1) : cueDuration;
    const nextDuration = currentDuration + additionalDuration;

    const nextParts = [...currentPromptParts, newPart];
    const nextPrompt = getEstimatedPrompt(nextParts);

    // If adding this cue exceeds limits, close current chunk and start a new one
    if (currentCues.length > 0 && (nextDuration > MAX_DURATION_PER_CALL || nextPrompt.length > 400)) {
      chunks.push({
        cues: currentCues,
        prompt: getEstimatedPrompt(currentPromptParts),
        duration: currentDuration
      });
      currentCues = [cue];
      currentDuration = cueDuration;
      currentPromptParts = [newPart];
    } else {
      currentCues.push(cue);
      currentDuration = nextDuration;
      currentPromptParts.push(newPart);
    }
  }

  if (currentCues.length > 0) {
    chunks.push({
      cues: currentCues,
      prompt: getEstimatedPrompt(currentPromptParts),
      duration: currentDuration
    });
  }

  return chunks;
}

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
      prompt_influence: 0.5, // Better prompt adherence
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
 * Handles SFX generation with ElevenLabs by chunking multiple cues
 * into a single request to save credits, then splitting them client-side.
 */
export async function generateCombinedSfx(
  allCues: SfxCue[],
  onProgress: (progress: number) => void
): Promise<Blob[]> {
  if (allCues.length === 0) return [];

  // 1. Group cues into credit-optimized chunks
  const chunks = chunkCues(allCues);
  console.log(`[ElevenLabs] Split ${allCues.length} cues into ${chunks.length} chunks to optimize credits.`);

  const finalAudioBlobs: Blob[] = new Array(allCues.length);
  let globalCueIndex = 0;

  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
    const chunk = chunks[chunkIdx];
    console.log(`[ElevenLabs] Processing Chunk ${chunkIdx + 1}/${chunks.length} (${chunk.cues.length} cues, ${chunk.duration}s): "${chunk.prompt}"`);

    try {
      // Generate the composite audio
      const compositeBlob = await callElevenLabsProxy(chunk.prompt, chunk.duration);

      // Split the composite audio back into individual cues
      const splitBlobs = await splitAudioBySilence(compositeBlob, chunk.cues.length);

      // Place them in finalAudioBlobs
      for (let i = 0; i < chunk.cues.length; i++) {
        finalAudioBlobs[globalCueIndex + i] = splitBlobs[i];
      }
    } catch (err) {
      console.error(`[ElevenLabs] Failed to process chunk ${chunkIdx + 1}:`, err);
      // Fallback: fill this chunk's slots with empty blobs so we don't break indices
      for (let i = 0; i < chunk.cues.length; i++) {
        finalAudioBlobs[globalCueIndex + i] = new Blob([], { type: 'audio/wav' });
      }
    }

    globalCueIndex += chunk.cues.length;
    onProgress(((chunkIdx + 1) / chunks.length) * 100);
  }

  return finalAudioBlobs;
}