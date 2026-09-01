import { TimelineClip, SubtitleItem } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { getGeminiKey } from './aiClient';
import { parseSRT } from './srtParser';

const uuidv4 = () => crypto.randomUUID();

export async function generateAutoCaptions(
  languages: string[],
  onProgress: (p: number) => void
): Promise<void> {
  const store = useEditorStore.getState();
  const apiKey = getGeminiKey();
  
  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Please configure it in Settings or environment variables.');
  }

  const totalDuration = store.totalDuration || 10;
  if (totalDuration <= 0) return;

  onProgress(5);

  // 1. Render Timeline Audio to WAV
  const wavBlob = await renderTimelineAudioToWav(store.tracks, totalDuration, store.mediaLibrary, (p) => {
    onProgress(5 + p * 0.4); // 5% to 45%
  });

  if (!wavBlob) {
    throw new Error('Failed to extract audio from timeline.');
  }

  // 2. Convert WAV to Base64
  const base64Audio = await blobToBase64(wavBlob);
  const dataPart = base64Audio.split(',')[1] || base64Audio;

  onProgress(50);

  // 3. Send to Gemini API
  const prompt = `You are a professional video transcription and translation assistant.
I have provided an audio track from a video timeline.
Please generate perfectly timed subtitles with WORD-LEVEL TIMESTAMPS for the following languages: ${languages.join(', ')}.

Return ONLY a valid JSON object where the keys are the 2-character language codes (e.g., "${languages[0]}") and the values are arrays of subtitle segments.
Each subtitle segment MUST follow this exact structure:
{
  "start": 0.0,
  "end": 2.5,
  "text": "Hello world",
  "speaker": "Speaker 1",
  "gender": "Male",
  "words": [
    { "word": "Hello", "start": 0.0, "end": 1.0 },
    { "word": "world", "start": 1.1, "end": 2.5 }
  ]
}

Identify the speaker and their likely gender ("Male", "Female", or "Unknown") for each segment. Ensure that the start and end times are floating point numbers representing seconds. Do not include markdown code blocks or any other text outside the JSON.`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'audio/wav',
              data: dataPart
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  onProgress(90);

  let resultJsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!resultJsonStr) {
    throw new Error('No valid response from Gemini.');
  }

  // Clean markdown if present
  resultJsonStr = resultJsonStr.replace(/^```(json)?/, '').replace(/```$/, '').trim();
  
  const srtResults = JSON.parse(resultJsonStr);

  // 4. Parse the JSON array and construct merged SubtitleItems
  const primaryLang = languages[0] || 'en';
  if (!srtResults[primaryLang] || !Array.isArray(srtResults[primaryLang])) {
    throw new Error(`Failed to generate subtitles in primary language (${primaryLang}).`);
  }

  const primarySegments = srtResults[primaryLang];

  const newSubtitles: SubtitleItem[] = primarySegments.map((sub: any, idx: number) => {
    const translations: Record<string, string> = {};
    for (const lang of languages) {
      if (srtResults[lang] && Array.isArray(srtResults[lang]) && srtResults[lang][idx]) {
        translations[lang] = srtResults[lang][idx].text;
      }
    }
    
    const startTime = typeof sub.start === 'number' ? sub.start : 0;
    const endTime = typeof sub.end === 'number' ? sub.end : startTime + 2;
    
    return {
      id: uuidv4(),
      startTime,
      endTime,
      text: sub.text || '',
      speaker: sub.speaker,
      gender: sub.gender,
      translations,
      words: Array.isArray(sub.words) ? sub.words : undefined
    };
  });

  store.setSubtitles(newSubtitles);
  onProgress(100);
}

// ------------------------------------------------------------------
// Audio Extraction Helpers
// ------------------------------------------------------------------

export async function renderTimelineAudioToWav(
  tracks: any[], 
  totalDuration: number, 
  mediaLibrary: any[],
  onProgress: (p: number) => void
): Promise<Blob | null> {
  // Use 16kHz sample rate to keep size small for Gemini
  const SAMPLE_RATE = 16000;
  const ctx = new OfflineAudioContext(1, SAMPLE_RATE * totalDuration, SAMPLE_RATE);

  const validTracks = tracks.filter(t => !t.muted && !t.hidden && (t.type === 'video' || t.type === 'audio'));
  const clips = validTracks.flatMap(t => t.clips.map((c: any) => ({...c, trackVolume: t.volume ?? 1.0})));
  
  if (clips.length === 0) return null;

  const audioCtx = new AudioContext();
  let decodedCount = 0;

  try {
    for (const clip of clips) {
      const media = mediaLibrary.find(m => m.id === clip.mediaId);
      if (!media || !media.url || media.url === 'PENDING_RESTORE') continue;

      try {
        const resp = await fetch(media.url);
        const arrayBuf = await resp.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuf);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = clip.speed;

        const gainNode = ctx.createGain();
        const clipVolume = clip.audioSettings?.muted ? 0 : (clip.audioSettings?.volume !== undefined ? Math.pow(10, clip.audioSettings.volume / 20) : 1.0);
        gainNode.gain.value = clipVolume * clip.trackVolume;

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        const offsetInSource = clip.trimStart;
        const duration = clip.duration;
        
        source.start(clip.startTime, offsetInSource, duration * clip.speed);
      } catch (e) {
        console.warn('Failed to decode audio for clip:', clip.id, e);
      }
      
      decodedCount++;
      onProgress(Math.floor((decodedCount / clips.length) * 80));
    }
  } finally {
    await audioCtx.close().catch(() => {});
  }

  onProgress(85);
  const renderedBuffer = await ctx.startRendering();
  onProgress(100);
  
  return audioBufferToWav(renderedBuffer);
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) { view.setUint16(pos, data, true); pos += 2; }
  function setUint32(data: number) { view.setUint32(pos, data, true); pos += 4; }

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16);         // length = 16
  setUint16(1);          // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2);                      // block-align
  setUint16(16);                                 // 16-bit

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([bufferArray], { type: 'audio/wav' });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
