import { TimelineClip } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { getGeminiKey } from './aiClient';
import { extractFramesFromVideo } from './frameExtractor';

const uuidv4 = () => crypto.randomUUID();

export interface KineticTypographyOptions {
  script: string;
  englishCasing?: 'all_caps' | 'first_letter_caps' | 'none';
}

export async function generateKineticTypography(
  clip: TimelineClip,
  trackId: string,
  options: KineticTypographyOptions,
  onProgress: (p: number) => void
): Promise<void> {
  const store = useEditorStore.getState();
  const apiKey = getGeminiKey();
  
  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Please configure it.');
  }

  const media = store.mediaLibrary.find(m => m.id === clip.mediaId);
  if (!media || !media.url || media.url === 'PENDING_RESTORE') {
    throw new Error('Media not available for analysis');
  }

  onProgress(10);

  // 1. Extract visual frames for the clip's duration
  const frames = await extractFramesFromVideo(media.url, 1, clip.trimStart, clip.trimStart + clip.duration);
  onProgress(30);

  // 2. Extract audio for the clip
  const wavBlob = await extractClipAudio(media.url, clip.trimStart, clip.duration);
  let audioDataPart: string | null = null;
  
  if (wavBlob) {
    const base64Audio = await blobToBase64(wavBlob);
    audioDataPart = base64Audio.split(',')[1] || base64Audio;
  }
  
  onProgress(50);

  // Translate script code to readable instruction
  let scriptInstruction = "";
  if (options.script === 'roman_urdu_hindi') {
    scriptInstruction = "Transcribe in Roman Urdu/Hindi (i.e. Urdu/Hindi written in English/Latin letters, e.g. 'aur all loving hai').";
  } else if (options.script === 'hindi') {
    scriptInstruction = "Transcribe in Devanagari Hindi script (e.g. 'और ऑल लविंग है').";
  } else if (options.script === 'english') {
    scriptInstruction = "Transcribe in English script.";
  } else {
    scriptInstruction = `Translate and transcribe the spoken words into the ${options.script.toUpperCase()} script/language.`;
  }

  // Casing requirement
  let casingInstruction = "";
  if (options.script === 'english') {
    if (options.englishCasing === 'all_caps') {
      casingInstruction = "Convert ALL words/letters to strictly UPPERCASE (e.g. 'HELLO', 'WORLD').";
    } else if (options.englishCasing === 'first_letter_caps') {
      casingInstruction = "Capitalize ONLY the first letter of each word (e.g. 'Hello', 'World').";
    }
  }

  // 3. Prepare Gemini API Request
  const prompt = `You are an expert Kinetic Typography & Motion Graphics designer.
I am providing visual frames and audio for a video clip (Duration: ${clip.duration.toFixed(2)} seconds).
Analyze the speech/audio beats and the visual framing.

YOUR PRIMARY TASK:
Generate a JSON array of text animation clips, strictly **WORD-BY-WORD**.
Each entry in the JSON must represent EXACTLY ONE word (e.g. "hello", not "hello there"). Do NOT combine words into sentences or phrases. Each word must have a short, precise duration.

Script / Translation requirement:
- ${scriptInstruction}
- ${casingInstruction}

For each word, choose different styles and effects that fit the tone of that specific word to make it visually engaging:
- "text": The spoken word (single word).
- "start": Start time relative to this clip (in seconds, between 0 and ${clip.duration.toFixed(2)}).
- "end": End time relative to this clip (in seconds).
- "fontSize": Font size between 50 and 120. Vary this to emphasize louder or important words!
- "fontFamily": Dynamically choose from: 'Inter', 'Outfit', 'Anton', 'Oswald', 'Bebas Neue', 'Impact', 'Montserrat', 'Georgia', 'Courier New'. Do not use just one font; vary them for style!
- "color": A vibrant hex color that contrasts well with the video frames. Change colors between words for visual variety!
- "x": X position (0 to 100, where 50 is center).
- "y": Y position (0 to 100, where 50 is center, usually around 80 for lower thirds, 50 for center pop).
- "animationIn": 'fadeIn', 'zoom', 'slideUp', 'slideDown', 'slideLeft', 'slideRight', 'bounce', or 'typewriter'.
- "animationOut": 'fadeOut', 'zoom', 'slideUp', 'slideDown', 'slideLeft', or 'slideRight'.

Output ONLY valid JSON array format, no markdown wrapping. Example:
[{"text":"Wow","start":0.5,"end":0.8,"fontSize":90,"fontFamily":"Anton","color":"#FFD700","x":50,"y":50,"animationIn":"zoom","animationOut":"fadeOut"}]`;

  const contentsParts: any[] = [{ text: prompt }];

  // Add audio if extracted
  if (audioDataPart) {
    contentsParts.push({
      inlineData: { mimeType: 'audio/wav', data: audioDataPart }
    });
  }

  // Add frames
  for (const frame of frames) {
    const b64 = frame.replace(/^data:image\/(png|jpeg|webp);base64,/, '');
    contentsParts.push({
      inlineData: { mimeType: 'image/jpeg', data: b64 }
    });
  }

  const requestBody = {
    contents: [{ parts: contentsParts }],
    generationConfig: {
      temperature: 0.3,
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
  onProgress(85);

  let resultJsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!resultJsonStr) {
    throw new Error('No valid response from Gemini.');
  }

  resultJsonStr = resultJsonStr.replace(/^```(json)?/, '').replace(/```$/, '').trim();
  const typoResults = JSON.parse(resultJsonStr);

  // Post-processing of text to guarantee casing constraints and word-by-word split if Gemini returned multiple words
  const processedClips: any[] = [];
  
  for (const item of typoResults) {
    const rawText = (item.text || '').trim();
    if (!rawText) continue;

    // Split in case Gemini returned a phrase/sentence instead of a single word
    const words = rawText.split(/\s+/);
    const durationPerWord = (item.end - item.start) / Math.max(1, words.length);

    words.forEach((w: string, idx: number) => {
      let wordText = w;
      if (options.script === 'english') {
        if (options.englishCasing === 'all_caps') {
          wordText = wordText.toUpperCase();
        } else if (options.englishCasing === 'first_letter_caps') {
          wordText = wordText.charAt(0).toUpperCase() + wordText.slice(1).toLowerCase();
        }
      }

      processedClips.push({
        ...item,
        text: wordText,
        start: item.start + (idx * durationPerWord),
        end: item.start + ((idx + 1) * durationPerWord)
      });
    });
  }

  // 4. Create new text clips and insert them above the current video track
  // Wait, if it's kinetic typography, we put it in a text track.
  const newClips: TimelineClip[] = processedClips.map((item: any) => {
    return {
      id: uuidv4(),
      mediaId: 'generator:kinetic',
      trackId: '',
      startTime: clip.startTime + item.start,
      duration: Math.max(0.1, item.end - item.start),
      trimStart: 0,
      trimEnd: Math.max(0.1, item.end - item.start),
      opacity: 1,
      transform: { x: item.x - 50, y: item.y - 50, scale: 100, rotation: 0 },
      speed: 1,
      effects: [],
      textSettings: {
        text: item.text,
        fontSize: item.fontSize || 60,
        fontFamily: item.fontFamily || 'Anton',
        color: item.color || '#ffffff',
        backgroundColor: 'transparent',
        bold: true,
        italic: false,
        underline: false,
        shadow: true,
        textAlign: 'center',
        animation: {
          in: item.animationIn === 'pop' ? 'zoom' : (item.animationIn || 'slideUp'),
          out: item.animationOut || 'fadeOut',
          inDuration: 0.1,
          outDuration: 0.1
        }
      }
    };
  });

  // Find or create a text track
  let textTrack = store.tracks.find(t => t.type === 'text' && !t.hidden);
  let newTracks = [...store.tracks];

  if (textTrack) {
    const updatedTrack = {
      ...textTrack,
      clips: [...textTrack.clips, ...newClips.map(c => ({...c, trackId: textTrack!.id}))]
    };
    newTracks = newTracks.map(t => t.id === textTrack!.id ? updatedTrack : t);
  } else {
    const newTrackId = uuidv4();
    const newTrack = {
      id: newTrackId,
      name: 'Kinetic Typography',
      type: 'text' as const,
      locked: false,
      muted: false,
      hidden: false,
      clips: newClips.map(c => ({...c, trackId: newTrackId})),
      overLayers: []
    };
    newTracks.push(newTrack);
  }

  useEditorStore.setState({ tracks: newTracks });
  onProgress(100);
}

async function extractClipAudio(mediaUrl: string, trimStart: number, duration: number): Promise<Blob | null> {
  try {
    const audioCtx = new AudioContext();
    const resp = await fetch(mediaUrl);
    const arrayBuf = await resp.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuf);

    const SAMPLE_RATE = 16000;
    const offlineCtx = new OfflineAudioContext(1, SAMPLE_RATE * duration, SAMPLE_RATE);

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0, trimStart, duration);

    const renderedBuffer = await offlineCtx.startRendering();
    audioCtx.close();
    
    return audioBufferToWav(renderedBuffer);
  } catch (e) {
    console.warn('Could not extract audio for clip, returning null', e);
    return null;
  }
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
