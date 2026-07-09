import { TimelineClip } from '@/types';
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
Please generate perfectly timed subtitles in SRT format for the following languages: ${languages.join(', ')}.

Return ONLY a valid JSON object where the keys are the 2-character language codes (e.g., "${languages[0]}") and the values are the raw SRT format strings. Do not include markdown code blocks or any other text outside the JSON.`;

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

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
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

  // 4. Create new subtitle track and parse SRTs
  const subtitleVariants: Record<string, TimelineClip[]> = {};
  
  for (const lang of languages) {
    if (srtResults[lang]) {
      const parsedSrt = parseSRT(srtResults[lang]);
      const clips: TimelineClip[] = parsedSrt.map((sub: any) => {
        const duration = sub.duration ?? ((sub.end && sub.start) ? sub.end - sub.start : 2);
        const startTime = sub.startTime ?? sub.start ?? 0;
        return {
          id: uuidv4(),
          mediaId: `subtitle:${lang}`,
          trackId: '', // Will be assigned when track is created
          startTime: sub.start,
          duration: duration,
          trimStart: 0,
          trimEnd: duration,
          opacity: 1,
          transform: { x: 0, y: 180, scale: 100, rotation: 0 },
          speed: 1,
          effects: [],
          textSettings: {
            text: sub.text,
            fontSize: 42,
            fontFamily: 'Inter',
            color: '#ffffff',
            backgroundColor: '#000000AA',
            bold: true,
            italic: false,
            underline: false,
            shadow: true,
            textAlign: 'center'
          }
        };
      });
      subtitleVariants[lang] = clips;
    }
  }

  onProgress(95);

  // Find or create subtitle track
  let targetTrack = store.tracks.find(t => t.type === 'text' && t.selectedSubtitleLanguage);
  let newTracks = [...store.tracks];

  if (targetTrack) {
    // Update existing subtitle track
    const updatedTrack = {
      ...targetTrack,
      subtitleVariants: subtitleVariants,
      selectedSubtitleLanguage: languages[0],
      clips: subtitleVariants[languages[0]] || []
    };
    // Update trackId in clips
    updatedTrack.clips.forEach(c => c.trackId = updatedTrack.id);
    for (const lang in updatedTrack.subtitleVariants) {
      updatedTrack.subtitleVariants[lang].forEach(c => c.trackId = updatedTrack.id);
    }
    newTracks = newTracks.map(t => t.id === targetTrack!.id ? updatedTrack : t);
  } else {
    // Create new subtitle track
    const newTrackId = uuidv4();
    const activeClips = subtitleVariants[languages[0]] || [];
    activeClips.forEach(c => c.trackId = newTrackId);
    
    for (const lang in subtitleVariants) {
      subtitleVariants[lang].forEach(c => c.trackId = newTrackId);
    }

    const newTrack = {
      id: newTrackId,
      name: 'Subtitles',
      type: 'text' as const,
      locked: false,
      muted: false,
      hidden: false,
      clips: activeClips,
      overLayers: [],
      selectedSubtitleLanguage: languages[0],
      subtitleVariants: subtitleVariants
    };
    newTracks.push(newTrack);
  }

  useEditorStore.setState({ tracks: newTracks });
  onProgress(100);
}

// ------------------------------------------------------------------
// Audio Extraction Helpers
// ------------------------------------------------------------------

async function renderTimelineAudioToWav(
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
  
  audioCtx.close();

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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
