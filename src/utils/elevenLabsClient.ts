import { getEnvElevenLabsKey, getLocalElevenLabsKey } from './apiKeyManager';
import { splitAudioBySilence } from './audioSplitter';

export interface SfxCue {
  id?: string;
  start: number;
  end: number;
  query: string;
  options?: any[];
}

export interface ChunkedGenerationRequest {
  cues: SfxCue[];
  totalExpectedDuration: number;
}

const MAX_DURATION_PER_CALL = 29; // max 29s per call to be safe (API max is 30)
const MAX_CHARS_PER_CALL = 400;   // ElevenLabs API max is 450 characters

/**
 * Groups a list of SFX cues into chunks that don't exceed the ElevenLabs duration or character limits.
 */
function chunkCues(cues: SfxCue[]): ChunkedGenerationRequest[] {
  // Pre-sanitize queries: truncate each query to max 150 chars so we can combine them easily
  const sanitizedCues = cues.map(cue => {
    let query = cue.query.trim();
    if (query.length > 150) {
      query = query.substring(0, 147) + "...";
    }
    return { ...cue, query };
  });

  const chunks: ChunkedGenerationRequest[] = [];
  let currentChunkCues: SfxCue[] = [];
  let currentChunkDuration = 0;

  for (const cue of sanitizedCues) {
    // Add 1 second of silence buffer per clip
    const cueDuration = (cue.end - cue.start) + 1; 

    // Check if adding this cue exceeds either limit
    const hypotheticalCues = [...currentChunkCues, cue];
    const wouldExceedDuration = currentChunkDuration + cueDuration > MAX_DURATION_PER_CALL;
    const wouldExceedChars = buildCombinedPrompt(hypotheticalCues).length > MAX_CHARS_PER_CALL;

    if ((wouldExceedDuration || wouldExceedChars) && currentChunkCues.length > 0) {
      chunks.push({
        cues: [...currentChunkCues],
        totalExpectedDuration: currentChunkDuration,
      });
      currentChunkCues = [];
      currentChunkDuration = 0;
    }

    currentChunkCues.push(cue);
    currentChunkDuration += cueDuration;
  }

  // Push the final chunk
  if (currentChunkCues.length > 0) {
    chunks.push({
      cues: currentChunkCues,
      totalExpectedDuration: currentChunkDuration,
    });
  }

  return chunks;
}

/**
 * Builds the combined prompt for a chunk of cues.
 */
function buildCombinedPrompt(cues: SfxCue[]): string {
  if (cues.length === 1) {
    const durationSecs = Math.max(1, Math.round(cues[0].end - cues[0].start));
    return `${cues[0].query}, ${durationSecs} seconds long, high quality sound effect`;
  }
  
  let prompt = "A sequence of distinct sound effects separated by 1 second of silence: ";
  const parts = cues.map((cue, index) => {
    const durationSecs = Math.max(1, Math.round(cue.end - cue.start));
    return `${index + 1}) ${cue.query} for ${durationSecs} seconds`;
  });
  
  return prompt + parts.join(", ");
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
      prompt_influence: 0.3,
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
 * Handles the complete pipeline: chunking -> prompting -> fetching -> splitting
 */
export async function generateCombinedSfx(
  allCues: SfxCue[],
  onProgress: (progress: number) => void
): Promise<Blob[]> {
  if (allCues.length === 0) return [];

  const chunks = chunkCues(allCues);
  const finalAudioBlobs: Blob[] = [];
  
  console.log(`[ElevenLabs] Split ${allCues.length} cues into ${chunks.length} chunks to optimize credits and prompt length.`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const combinedPrompt = buildCombinedPrompt(chunk.cues);
    
    console.log(`[ElevenLabs] Processing Chunk ${i + 1}/${chunks.length}:`, combinedPrompt);
    
    try {
      // 1. Generate the single combined audio file
      const chunkAudioBlob = await callElevenLabsProxy(combinedPrompt, Math.min(29, chunk.totalExpectedDuration));
      
      // 2. Client-side silence detection to split it back into individual clips
      const individualClips = await splitAudioBySilence(chunkAudioBlob, chunk.cues.length);
      
      finalAudioBlobs.push(...individualClips);
    } catch (err) {
      console.error(`[ElevenLabs] Chunk ${i + 1} failed:`, err);
      // Push empty blobs to keep indices aligned, then continue with remaining chunks
      for (let j = 0; j < chunk.cues.length; j++) {
        finalAudioBlobs.push(new Blob([], { type: 'audio/wav' }));
      }
    }
    
    onProgress(((i + 1) / chunks.length) * 100);
  }

  return finalAudioBlobs;
}
