import { useEditorStore } from '@/store/editorStore';
import { getGeminiKey } from './aiClient';
import { renderTimelineAudioToWav, blobToBase64 } from './autoCaptions';
import { TimelineClip } from '@/types';

const uuidv4 = () => crypto.randomUUID();

export async function syncAiVoiceToSubtitles(
  targetTrackId: string,
  language: string,
  onProgress: (p: number) => void
): Promise<void> {
  const store = useEditorStore.getState();
  const apiKey = getGeminiKey();
  
  if (!apiKey) {
    throw new Error('Gemini API Key is missing. Please configure it in Settings or environment variables.');
  }

  const targetTrack = store.tracks.find(t => t.id === targetTrackId);
  if (!targetTrack || targetTrack.clips.length === 0) {
    throw new Error('Selected track is empty or not found.');
  }

  const totalDuration = store.totalDuration || 10;
  
  onProgress(10);

  // 1. Render ONLY the target track to WAV
  const wavBlob = await renderTimelineAudioToWav([targetTrack], totalDuration, store.mediaLibrary, (p) => {
    onProgress(10 + p * 0.3); // 10% to 40%
  });

  if (!wavBlob) {
    throw new Error('Failed to extract audio from the selected track.');
  }

  // 2. Convert WAV to Base64
  const base64Audio = await blobToBase64(wavBlob);
  const dataPart = base64Audio.split(',')[1] || base64Audio;

  onProgress(45);

  // 3. Send to Gemini API to transcribe the AI voice
  const prompt = `You are a professional audio transcription assistant.
I have provided an audio track containing a voiceover.
Please transcribe this voiceover in language "${language}" and provide precise WORD-LEVEL TIMESTAMPS.

Return ONLY a valid JSON object where the root is an array of subtitle segments.
Each subtitle segment MUST follow this exact structure:
[
  {
    "start": 0.0,
    "end": 2.5,
    "text": "Hello world",
    "words": [
      { "word": "Hello", "start": 0.0, "end": 1.0 },
      { "word": "world", "start": 1.1, "end": 2.5 }
    ]
  }
]

Ensure that the start and end times are floating point numbers representing seconds relative to the audio file. Do not include markdown code blocks or any other text outside the JSON.`;

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
      temperature: 0.1,
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
  onProgress(80);

  let resultJsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!resultJsonStr) {
    throw new Error('No valid response from Gemini.');
  }

  resultJsonStr = resultJsonStr.replace(/^```(json)?/, '').replace(/```$/, '').trim();
  const aiSegments = JSON.parse(resultJsonStr);

  if (!Array.isArray(aiSegments)) {
    throw new Error('Failed to parse AI transcription JSON.');
  }

  onProgress(90);

  // 4. Match AI transcription segments with existing subtitles
  const originalSubtitles = store.subtitles;
  if (originalSubtitles.length === 0) {
    throw new Error('No subtitles found in the project to sync against.');
  }

  const newClips: TimelineClip[] = [];

  // Helper to find original media mapping for a given rendered time
  const getSourceMapping = (time: number) => {
    for (const clip of targetTrack.clips) {
      if (time >= clip.startTime && time <= clip.startTime + clip.duration) {
        const mediaTime = clip.trimStart + (time - clip.startTime) * (clip.speed || 1);
        return { clip, mediaTime };
      }
    }
    // If not found inside a clip (e.g., slight overflow), snap to the closest clip
    return { clip: targetTrack.clips[0], mediaTime: targetTrack.clips[0].trimStart };
  };

  // We simply map the Nth AI segment to the Nth Original Subtitle
  const count = Math.min(originalSubtitles.length, aiSegments.length);

  for (let i = 0; i < count; i++) {
    const originalSub = originalSubtitles[i];
    const aiSeg = aiSegments[i];

    const aiStart = typeof aiSeg.start === 'number' ? aiSeg.start : 0;
    const aiEnd = typeof aiSeg.end === 'number' ? aiSeg.end : aiStart + 2;

    const startMapping = getSourceMapping(aiStart);
    const endMapping = getSourceMapping(aiEnd);

    const sourceClip = startMapping.clip; // Base the new clip on the source clip of the start time

    const origStart = originalSub.startTime;
    const origEnd = originalSub.endTime;
    const origDuration = Math.max(0.1, origEnd - origStart);

    const aiDurationInMedia = endMapping.mediaTime - startMapping.mediaTime;
    
    // We want the AI audio to play from origStart to origEnd.
    const requiredSpeed = Math.max(0.1, Math.min(10, aiDurationInMedia / origDuration));

    const newClip: TimelineClip = {
      ...sourceClip,
      id: uuidv4(),
      startTime: origStart,
      duration: origDuration,
      trimStart: startMapping.mediaTime,
      speed: requiredSpeed,
      audioSettings: {
        volume: 0,
        pan: 0,
        fadeIn: 0,
        fadeOut: 0,
        bass: 0,
        treble: 0,
        muted: false,
        pitch: 0,
        voiceFormant: 0,
        humanize: false,
        ...(sourceClip.audioSettings || {}),
        preservePitch: true
      } as any
    };

    newClips.push(newClip);
  }

  // 5. Update the track with the newly synced clips
  const updatedTracks = store.tracks.map(t => {
    if (t.id === targetTrackId) {
      return { ...t, clips: newClips };
    }
    return t;
  });

  useEditorStore.setState({ tracks: updatedTracks });
  onProgress(100);
}
