import { useCallback } from 'react';
import { useEditorStore, findClipDeep } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import type { TimelineClip, TimelineTrack } from '@/types';
import { synthesizeProceduralSFX } from '../sfxSynth';
import { parseTransliteratedResponse } from '../timelineUtils';
import type { TimelineState } from './useTimelineState';

interface UseTimelineAIDeps {
  timelineState: TimelineState;
}

async function handlePuterError(err: any, taskName: string): Promise<void> {
  console.error(`${taskName} failed:`, err);
  const isCreditsErr = String(err.message || err).toLowerCase().includes('credit') ||
                       String(err.message || err).toLowerCase().includes('balance');
  if (isCreditsErr) {
    const puter = (window as any).puter;
    if (puter) {
      const confirmSignIn = window.confirm(
        `${taskName} failed due to Insufficient Credits on Puter.\n\n` +
        "Puter AI offers a generous free tier for registered accounts. Would you like to log in to (or sign up for) Puter for free to get your personal free credits?"
      );
      if (confirmSignIn) {
        try {
          await puter.auth.signIn();
          alert("Successfully logged in! Please try your request again.");
        } catch (authErr) {
          console.error('Puter auth failed:', authErr);
        }
      }
    } else {
      alert(`${taskName} failed: ${err.message || 'Unknown error'}`);
    }
  } else {
    alert(`${taskName} failed: ${err.message || 'Unknown error'}`);
  }
}

export function useTimelineAI({ timelineState }: UseTimelineAIDeps) {
  const {
    tracks,
    mediaLibrary,
    addClip,
  } = useEditorStore(useShallow(s => ({
    tracks: s.tracks,
    mediaLibrary: s.mediaLibrary,
    addClip: s.addClip,
  })));

  const {
    setSfxModalClipId,
    setSfxCategory,
    setSfxName,
    setSfxDuration,
    setIsAnalyzingSfx,
    setIsSynthesizingSfx,
    sfxModalClipId,
    sfxCategory,
    sfxName,
    sfxDuration,
    sfxAutoCueClipId,
    sfxAutoCueMode,
    sfxUserDescription,
    setIsAnalyzingAutoCue,
    setAutoCueProgress,
    setSfxAutoCueClipId,
    setSfxUserDescription,
    setIsTranscribing,
  } = timelineState;

  const handleOpenSfxGenerator = useCallback(async (clipId: string) => {
    const targetClip = findClipDeep(useEditorStore.getState(), clipId)?.clip || null;
    if (!targetClip) return;

    const mediaItem = mediaLibrary.find(m => m.id === targetClip!.mediaId);
    const clipName = mediaItem ? mediaItem.name : 'Unknown Clip';
    const clipType = mediaItem ? mediaItem.type : 'video';

    setSfxModalClipId(clipId);
    setSfxCategory('explosion');
    setSfxName(`SFX: ${clipName.slice(0, 20)}`);
    setSfxDuration(1.0);
    setIsAnalyzingSfx(true);

    try {
      const puter = (window as any).puter;
      if (puter) {
        const responseText = await puter.ai.chat(
          `Analyze this video/audio clip:
Name: "${clipName}"
Type: "${clipType}"
Duration: ${targetClip.duration} seconds

We need to generate a sound effect (SFX) that matches this clip. Select the best match from these synthesized categories:
- 'explosion' (for blasts, crashes, booms, heavy hits)
- 'laser' (for zaps, laser shots, futuristic beams)
- 'swoosh' (for passes, fast movements, transitions, wind sweeps)
- 'jump' (for retro jumps, pops, upward sweeps, power-ups)
- 'bubble' (for water pops, liquid sounds, cute clicks)
- 'alarm' (for beeps, warning sirens, electronic alerts)
- 'click' (for UI buttons, ticks, small impacts)
- 'ambient' (for background wind, hums, static noise, room tone)
- 'waves' (for sea/ocean waves, flowing water, wind rustle)
- 'flying' (for flying drones, engine hums, fast flight swooshes)
- 'magic' (for sparkles, chimes, magical spells, fairy dust)
- 'punch' (for punches, slap hits, thuds, body blows)
- 'footsteps' (for walking steps, running, movement sounds)
- 'gunshot' (for gun blast, crack, explosion sound)
- 'spark' (for electrical sparks, lightning crackles, short circuits)

Also suggest a descriptive name for the sound effect (e.g. "Space Laser Zap", "Distant Explosion", "Fast Whoosh").
NOTE: If the clip name contains only numbers or random characters (e.g., "12345.mp4", "VID_2026.mp4", "unnamed.png") or is not descriptive, please choose 'swoosh' as the category and suggest "Transition Swoosh" as the name.

Return your response ONLY as a JSON object with these two fields:
{
  "category": "category_name",
  "name": "Sound Name"
}`
        );

        const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.category) setSfxCategory(parsed.category);
          if (parsed.name) setSfxName(parsed.name);
        }
      }
    } catch (err) {
      console.error('Failed to analyze clip for SFX:', err);
    } finally {
      setIsAnalyzingSfx(false);
    }
  }, [tracks, mediaLibrary, setSfxModalClipId, setSfxCategory, setSfxName, setSfxDuration, setIsAnalyzingSfx]);

  const handleGenerateSFX = useCallback(async () => {
    if (!sfxModalClipId) return;

    let targetClip: TimelineClip | null = null;
    for (const track of tracks) {
      const found = track.clips.find(c => c.id === sfxModalClipId);
      if (found) {
        targetClip = found;
        break;
      }
    }
    if (!targetClip) return;

    setIsSynthesizingSfx(true);
    try {
      const blob = await synthesizeProceduralSFX(sfxCategory, sfxDuration);
      const audioUrl = URL.createObjectURL(blob);

      const mediaId = `sfx_${Date.now()}`;
      const newMediaItem = {
        id: mediaId,
        name: sfxName,
        type: 'audio' as const,
        duration: sfxDuration,
        url: audioUrl,
        createdAt: Date.now()
      };

      const peaks: number[] = [];
      for (let i = 0; i < 100; i++) {
        peaks.push(0.1 + Math.random() * 0.7);
      }

      const finalMediaItem = {
        ...newMediaItem,
        waveformPeaks: peaks
      };

      try {
        await useEditorStore.getState().addMedia(finalMediaItem, new File([blob], `${mediaId}.wav`, { type: 'audio/wav' }));
      } catch (err) {
        console.error('Failed to save SFX to IndexedDB:', err);
        useEditorStore.getState().addMedia(finalMediaItem);
      }

      let audioTrack = tracks.find(t => t.type === 'audio');
      if (!audioTrack) {
        useEditorStore.getState().addTrack('audio');
        const updatedTracks = useEditorStore.getState().tracks;
        audioTrack = updatedTracks.find(t => t.type === 'audio') || updatedTracks[updatedTracks.length - 1];
      }

      const newAudioClip = {
        id: `clip_sfx_${Math.random().toString(36).substr(2, 9)}`,
        mediaId: mediaId,
        trackId: audioTrack.id,
        startTime: targetClip.startTime,
        duration: sfxDuration,
        trimStart: 0,
        trimEnd: 0,
        transform: { x: 0, y: 0, scale: 100, rotation: 0 },
        opacity: 1,
        speed: 1,
        effects: []
      };

      useEditorStore.getState().startTransaction();
      try {
        addClip(newAudioClip as any);
      } finally {
        useEditorStore.getState().endTransaction();
      }
      useEditorStore.getState().saveSnapshot('AI Sound Effect Generation');

      setSfxModalClipId(null);
    } catch (err: any) {
      await handlePuterError(err, 'AI Sound Effect');
    } finally {
      setIsSynthesizingSfx(false);
    }
  }, [sfxModalClipId, sfxCategory, sfxDuration, sfxName, tracks, addClip, setIsSynthesizingSfx, setSfxModalClipId]);

  const handleAuditionSFX = useCallback(async () => {
    try {
      const blob = await synthesizeProceduralSFX(sfxCategory, sfxDuration);
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.play().catch(() => {});
    } catch (err) {
      console.error('Failed to audition SFX:', err);
    }
  }, [sfxCategory, sfxDuration]);

  const handleAutoCueSFX = useCallback(async () => {
    if (!sfxAutoCueClipId) return;

    const targetClip = findClipDeep(useEditorStore.getState(), sfxAutoCueClipId)?.clip || null;
    if (!targetClip) return;

    const mediaItem = mediaLibrary.find(m => m.id === targetClip!.mediaId);
    if (!mediaItem || !mediaItem.url) {
      alert('Media source file not found.');
      return;
    }

    setIsAnalyzingAutoCue(true);
    setAutoCueProgress(0);

    try {
      let cuePoints: { time: number; duration: number; category: string; name: string }[] = [];

      if (sfxAutoCueMode === 'visual') {
        const video = document.createElement('video');
        video.src = mediaItem.url;
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.playsInline = true;

        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = () => reject(new Error('Failed to load video metadata for visual analysis.'));
        });

        const clipDur = targetClip.duration;
        const scanFps = 4;
        const step = 1 / scanFps;
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 18;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) throw new Error('Failed to create offscreen canvas context.');

        let prevFrameData: Uint8ClampedArray | null = null;
        const motionDiffs: { time: number; diff: number }[] = [];

        for (let time = 0; time < clipDur; time += step) {
          video.currentTime = time;
          await new Promise((resolve) => {
            video.onseeked = resolve;
          });

          ctx.drawImage(video, 0, 0, 32, 18);
          const frameData = ctx.getImageData(0, 0, 32, 18).data;

          if (prevFrameData) {
            let sumDiff = 0;
            for (let i = 0; i < frameData.length; i += 4) {
              sumDiff += Math.abs(frameData[i] - prevFrameData[i]) +
                         Math.abs(frameData[i+1] - prevFrameData[i+1]) +
                         Math.abs(frameData[i+2] - prevFrameData[i+2]);
            }
            const avgDiff = sumDiff / (32 * 18 * 3);
            motionDiffs.push({ time, diff: avgDiff });
          }

          prevFrameData = frameData;
          setAutoCueProgress(Math.floor((time / clipDur) * 90));
        }

        if (motionDiffs.length > 0) {
          const diffValues = motionDiffs.map(m => m.diff);
          const mean = diffValues.reduce((a, b) => a + b, 0) / diffValues.length;
          const stdDev = Math.sqrt(diffValues.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / diffValues.length);
          const threshold = mean + 2.0 * stdDev;

          for (let i = 1; i < motionDiffs.length - 1; i++) {
            const current = motionDiffs[i];
            const prev = motionDiffs[i - 1];
            const next = motionDiffs[i + 1];

            if (current.diff > threshold && current.diff > prev.diff && current.diff > next.diff) {
              const isHugeSpike = current.diff > (mean + 3.5 * stdDev);
              const category = isHugeSpike ? 'explosion' : 'swoosh';
              const sfxName = isHugeSpike ? 'Action Peak Hit' : 'Motion Swoosh';

              cuePoints.push({
                time: current.time,
                duration: isHugeSpike ? 1.5 : 0.6,
                category,
                name: sfxName
              });

              i += Math.floor(0.75 * scanFps);
            }
          }
        }
      } else {
        const puter = (window as any).puter;
        if (!puter) {
          throw new Error('Puter AI engine is not loaded. Please connect to the internet.');
        }

        setAutoCueProgress(40);
        const responseText = await puter.ai.chat(
          `We have a video clip named "${mediaItem.name}" of duration ${targetClip.duration} seconds.
The user describes the action: "${sfxUserDescription}".

We need to generate matching sound effects (SFX) that fit the video timeline.
Choose ONLY from these categories: 'explosion', 'laser', 'swoosh', 'jump', 'bubble', 'alarm', 'click', 'ambient', 'waves', 'flying', 'magic', 'punch', 'footsteps', 'gunshot', 'spark'.

Return a list of sound effects to place, with their start time (relative to the video start, between 0 and ${targetClip.duration} seconds) and duration.
Return your response ONLY as a JSON array of objects:
[
  {
    "time": 1.2,
    "duration": 0.8,
    "category": "category_name",
    "name": "Sound Name"
  }
]`
        );
        setAutoCueProgress(80);

        const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          cuePoints = JSON.parse(jsonMatch[0]);
        }
      }

      if (cuePoints.length === 0) {
        throw new Error('No action points or cues detected. Try describing the action more explicitly.');
      }

      let audioTrack = tracks.find(t => t.type === 'audio');
      if (!audioTrack) {
        useEditorStore.getState().addTrack('audio');
        const updatedTracks = useEditorStore.getState().tracks;
        audioTrack = updatedTracks.find(t => t.type === 'audio') || updatedTracks[updatedTracks.length - 1];
      }

      useEditorStore.getState().startTransaction();
      try {
        for (let i = 0; i < cuePoints.length; i++) {
          const cue = cuePoints[i];
          const category = cue.category || 'swoosh';
          const duration = Math.max(0.1, Number(cue.duration) || 1.0);
          const timeOffset = Number(cue.time) || 0;
          const name = cue.name || 'AI SFX';

          const blob = await synthesizeProceduralSFX(category, duration);
          const audioUrl = URL.createObjectURL(blob);

          const mediaId = `sfx_autocue_${Date.now()}_${i}`;
          const newMediaItem = {
            id: mediaId,
            name: name,
            type: 'audio' as const,
            duration: duration,
            url: audioUrl,
            createdAt: Date.now()
          };

          const peaks: number[] = [];
          for (let p = 0; p < 100; p++) {
            peaks.push(0.1 + Math.random() * 0.7);
          }

          const finalMediaItem = {
            ...newMediaItem,
            waveformPeaks: peaks
          };

          try {
            await useEditorStore.getState().addMedia(finalMediaItem, new File([blob], `${mediaId}.wav`, { type: 'audio/wav' }));
          } catch (err) {
            useEditorStore.getState().addMedia(finalMediaItem);
          }

          const newAudioClip = {
            id: `clip_sfx_cue_${Math.random().toString(36).substr(2, 9)}`,
            mediaId: mediaId,
            trackId: audioTrack.id,
            startTime: targetClip.startTime + timeOffset,
            duration: duration,
            trimStart: 0,
            trimEnd: 0,
            transform: { x: 0, y: 0, scale: 100, rotation: 0 },
            opacity: 1,
            speed: 1,
            effects: []
          };

          addClip(newAudioClip as any);
        }
      } finally {
        useEditorStore.getState().endTransaction();
      }
      useEditorStore.getState().saveSnapshot('AI Sound Effects Auto-Cue');

      setSfxAutoCueClipId(null);
      setSfxUserDescription('');
      alert(`Successfully generated and auto-placed ${cuePoints.length} sound effects!`);
    } catch (err: any) {
      await handlePuterError(err, 'Auto-Cue Sound Effects');
    } finally {
      setIsAnalyzingAutoCue(false);
      setAutoCueProgress(0);
    }
  }, [sfxAutoCueClipId, sfxAutoCueMode, sfxUserDescription, tracks, mediaLibrary, addClip, setIsAnalyzingAutoCue, setAutoCueProgress, setSfxAutoCueClipId, setSfxUserDescription]);

  const handleGenerateSubtitles = useCallback(async (clipId: string, mode: 'standard' | 'dynamic') => {
    const targetClip = findClipDeep(useEditorStore.getState(), clipId)?.clip || null;
    if (!targetClip) return;

    const mediaItem = mediaLibrary.find(m => m.id === targetClip!.mediaId);
    if (!mediaItem || !mediaItem.url) {
      alert('Media source file not found.');
      return;
    }

    setIsTranscribing(true);

    try {
      const response = await fetch(mediaItem.url);
      if (!response.ok) throw new Error('Failed to retrieve clip media blob.');
      const blob = await response.blob();

      const file = new File([blob], 'audio.mp3', { type: blob.type || 'audio/mp3' });

      const puter = (window as any).puter;
      if (!puter) {
        throw new Error('Puter AI engine is not loaded. Make sure you are connected to the internet.');
      }

      const result = await puter.ai.speech2txt({
        audio: file,
        provider: 'openai',
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word']
      });

      if (!result || !result.words || result.words.length === 0) {
        throw new Error('No words detected in this clip. Ensure the clip has clear audible speech.');
      }

      let textTrack = useEditorStore.getState().tracks.find(t => t.type === 'text');
      if (!textTrack) {
        useEditorStore.getState().addTrack('text');
        const freshTracks = useEditorStore.getState().tracks;
        textTrack = freshTracks.find(t => t.type === 'text');
        if (!textTrack) {
          throw new Error('Could not create a text track to place subtitles.');
        }
      }

      useEditorStore.getState().startTransaction();
      try {
        const clipStart = targetClip.startTime;

        if (mode === 'standard') {
          const maxCharLimit = 36;
          const maxTimeLimit = 2.5;
          const maxWordsLimit = 5;

          let currentGroup: any[] = [];
          const subtitleGroups: any[] = [];

          for (const w of result.words) {
            const groupText = currentGroup.map(item => item.word).join(' ');
            const currentGroupDuration = currentGroup.length > 0 ? (w.end - currentGroup[0].start) : 0;

            const exceedsChars = (groupText.length + w.word.length) > maxCharLimit;
            const exceedsTime = currentGroupDuration > maxTimeLimit;
            const exceedsWords = currentGroup.length >= maxWordsLimit;
            const hasBigGap = currentGroup.length > 0 && (w.start - currentGroup[currentGroup.length - 1].end) > 1.2;

            if (currentGroup.length > 0 && (exceedsChars || exceedsTime || exceedsWords || hasBigGap)) {
              subtitleGroups.push([...currentGroup]);
              currentGroup = [];
            }
            currentGroup.push(w);
          }
          if (currentGroup.length > 0) {
            subtitleGroups.push(currentGroup);
          }

          const newSubs = subtitleGroups.map((group) => {
            const firstWord = group[0];
            const lastWord = group[group.length - 1];
            const phraseText = group.map((w: any) => w.word).join(' ');
            const phraseStart = clipStart + firstWord.start;
            const phraseEnd = clipStart + lastWord.end;

            return {
              id: `sub_${Math.random().toString(36).substr(2, 9)}`,
              startTime: phraseStart,
              endTime: phraseEnd,
              text: phraseText,
              translations: { en: phraseText }
            };
          });

          useEditorStore.getState().setSubtitles(newSubs);
        } else {
          const colors = ['#ffffff', '#fbbf24', '#22c55e', '#22d3ee', '#f43f5e', '#a855f7'];
          const animations = ['zoom', 'bounce', 'slideUp'];

          for (let i = 0; i < result.words.length; i++) {
            const w = result.words[i];
            const wordText = w.word.trim();
            if (!wordText) continue;

            const wordStart = clipStart + w.start;
            let wordDur = w.end - w.start;
            if (wordDur > 0.45) wordDur = 0.45;
            else wordDur = Math.max(0.1, wordDur * 0.75);

            const color = colors[i % colors.length];
            const animIn = animations[i % animations.length];

            const staggerX = Math.floor(Math.random() * 30) - 15;
            const staggerY = 120 + Math.floor(Math.random() * 20) - 10;
            const rotation = Math.floor(Math.random() * 10) - 5;

            const newTypoClip = {
              id: `clip_typo_${Math.random().toString(36).substr(2, 9)}`,
              mediaId: 'text-placeholder',
              trackId: textTrack.id,
              startTime: wordStart,
              duration: wordDur,
              trimStart: 0,
              trimEnd: 0,
              transform: { x: staggerX, y: staggerY, scale: 100, rotation },
              opacity: 1,
              speed: 1,
              effects: [],
              textSettings: {
                text: wordText.toUpperCase(),
                fontSize: 42,
                fontFamily: 'Impact',
                color: color,
                strokeWidth: 5,
                strokeColor: '#000000',
                bold: true,
                shadow: true,
                textAlign: 'center' as CanvasTextAlign,
                animation: {
                  in: animIn,
                  out: 'fadeOut',
                  inDuration: 0.08,
                  outDuration: 0.08
                }
              }
            };

            addClip(newTypoClip as any);
          }
        }
      } finally {
        useEditorStore.getState().endTransaction();
      }
      useEditorStore.getState().saveSnapshot(mode === 'standard' ? 'Auto-Generate Captions' : 'Generate Dynamic Typography');
    } catch (err: any) {
      await handlePuterError(err, 'AI Auto-Captioning');
    } finally {
      setIsTranscribing(false);
    }
  }, [tracks, mediaLibrary, addClip, setIsTranscribing]);

  return {
    handleOpenSfxGenerator,
    handleGenerateSFX,
    handleAuditionSFX,
    handleAutoCueSFX,
    handleGenerateSubtitles,
  };
}
