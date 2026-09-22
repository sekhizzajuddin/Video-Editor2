import { useCallback, useRef } from 'react';
import { useEditorStore, findClipDeep, findClipInTracks } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import type { TimelineClip } from '@/types';
import { synthesizeProceduralSFX } from '../sfxSynth';
import { parseTransliteratedResponse } from '../timelineUtils';
import type { TimelineState } from './useTimelineState';
import { toast } from 'sonner';
import { extractWaveformFromUrl } from '@/utils/mediaProbe';
import { attachInvisibleMediaElement } from '@/utils/mediaPoolContainer';

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
          toast.success("Successfully logged in! Please try your request again.");
        } catch (authErr) {
          console.error('Puter auth failed:', authErr);
        }
      }
    } else {
      toast.error(`${taskName} failed: ${err.message || 'Unknown error'}`);
    }
  } else {
    toast.error(`${taskName} failed: ${err.message || 'Unknown error'}`);
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

  // P1 FIX: track the audition Audio element + blob URL — repeated auditions used
  // to leak blob URLs (never revoked) and overlap concurrent playback.
  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);
  const auditionAudioUrlRef = useRef<string | null>(null);

  // P3 FIX: map a clip's timeline start to its ABSOLUTE position — PIP clips
  // live in PIP-local time; placing derived clips (SFX) at the raw startTime
  // put them at the wrong main-timeline position.
  const getClipAbsoluteStart = useCallback((clip: TimelineClip): number => {
    const state = useEditorStore.getState();
    const found = findClipDeep(state, clip.id);
    if (found?.isPip && found.pipId) {
      const pip = (state.pipWindows || {})[found.pipId];
      if (pip) {
        const parentClip = findClipInTracks(state.tracks, pip.parentClipId, state.pipWindows || {});
        return (parentClip?.startTime ?? 0) + (pip.relativeStartTime || 0) + clip.startTime;
      }
    }
    return clip.startTime;
  }, []);

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

        // P3 FIX: the non-greedy regex grabbed the NEAREST closing brace — prose
        // or braces inside string fields broke JSON.parse silently (defaults were
        // then shown as if AI recommended them). Greedy bracket matching from the
        // first '{' is robust.
        const jsonStart = responseText.indexOf('{');
        if (jsonStart !== -1) {
          let depth = 0;
          let jsonEnd = -1;
          for (let i = jsonStart; i < responseText.length; i++) {
            if (responseText[i] === '{') depth++;
            else if (responseText[i] === '}') {
              depth--;
              if (depth === 0) { jsonEnd = i; break; }
            }
          }
          if (jsonEnd !== -1) {
            try {
              const parsed = JSON.parse(responseText.slice(jsonStart, jsonEnd + 1));
              if (parsed.category) setSfxCategory(parsed.category);
              if (parsed.name) setSfxName(parsed.name);
            } catch { /* keep defaults */ }
          }
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

    // P3 FIX: search PIP windows too — handleOpenSfxGenerator uses findClipDeep
    // (so the modal opens for PIP clips) but this only searched top-level tracks,
    // making "Generate & Add" silently no-op for PIP clips.
    const foundDeep = findClipDeep(useEditorStore.getState(), sfxModalClipId);
    const targetClip = foundDeep?.clip || null;
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

      let peaks: number[] = [];
      try {
        peaks = await extractWaveformFromUrl(audioUrl);
      } catch {
        peaks = Array.from({ length: 200 }, () => 0);
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
        id: mediaId,
        mediaId: mediaId,
        trackId: audioTrack.id,
        // P3 FIX: absolute position — PIP clips live in PIP-local time
        startTime: getClipAbsoluteStart(targetClip),
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
  }, [sfxModalClipId, sfxCategory, sfxDuration, sfxName, tracks, addClip, setIsSynthesizingSfx, setSfxModalClipId, getClipAbsoluteStart]);

  const handleAuditionSFX = useCallback(async () => {
    try {
      // P1 FIX: stop + revoke the previous audition first — repeated clicks used
      // to leak blob URLs and overlap concurrent playback.
      if (auditionAudioRef.current) {
        try { auditionAudioRef.current.pause(); } catch { /* already stopped */ }
        auditionAudioRef.current = null;
      }
      if (auditionAudioUrlRef.current) {
        URL.revokeObjectURL(auditionAudioUrlRef.current);
        auditionAudioUrlRef.current = null;
      }
      const blob = await synthesizeProceduralSFX(sfxCategory, sfxDuration);
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      auditionAudioRef.current = audio;
      auditionAudioUrlRef.current = audioUrl;
      audio.onended = () => {
        if (auditionAudioUrlRef.current === audioUrl) {
          URL.revokeObjectURL(audioUrl);
          auditionAudioUrlRef.current = null;
        }
        if (auditionAudioRef.current === audio) auditionAudioRef.current = null;
      };
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
      toast.warning('Media source file not found.');
      return;
    }

    setIsAnalyzingAutoCue(true);
    setAutoCueProgress(0);

    try {
      let cuePoints: { time: number; duration: number; category: string; name: string }[] = [];

      if (sfxAutoCueMode === 'visual') {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        // ANDROID FIX: keep element composited while seeking/drawing frames for
        // motion analysis — detached/invisible videos never produce frames on
        // Chrome-Android (see utils/mediaPoolContainer.ts).
        attachInvisibleMediaElement(video);
        video.src = mediaItem.url;

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

        // P3 FIX: wrap the scan loop in try/finally so the analysis video element
        // is always released (it lives in the shared media pool container).
        try {
          for (let time = 0; time < clipDur; time += step) {
            video.currentTime = time;
            // P3 FIX: a stalled seek used to await forever — isAnalyzingAutoCue
            // stayed true, the X/Cancel buttons were disabled, and the user was
            // trapped (only a reload escaped). Timeout each seek.
            await new Promise((resolve) => {
              let done = false;
              const finish = () => {
                if (done) return;
                done = true;
                video.onseeked = null;
                clearTimeout(timer);
                resolve(null);
              };
              const timer = setTimeout(finish, 2000);
              video.onseeked = finish;
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
        } finally {
          // Release the analysis element — it lives in the shared media pool
          // container, so it must clean itself up when done.
          video.src = '';
          video.load();
          video.remove();
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

        // P3 FIX: wire in the robust parser (markdown-fence stripping + greedy
        // bracket matching — already written in timelineUtils, was a dead import).
        // The non-greedy regex grabbed the nearest ']' and failed on prose with
        // brackets, surfacing a misleading "No action points detected" error.
        const parsedCues = parseTransliteratedResponse(String(responseText ?? ''));
        if (parsedCues && Array.isArray(parsedCues)) {
          cuePoints = parsedCues;
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
          // P3 FIX: clamp AI-returned times to the clip — an AI time beyond the
          // clip duration placed SFX past the clip end.
          const timeOffset = Math.min(Math.max(0, Number(cue.time) || 0), Math.max(0, targetClip.duration - duration));
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

          let peaks: number[] = [];
          try {
            peaks = await extractWaveformFromUrl(audioUrl);
          } catch {
            peaks = Array.from({ length: 200 }, () => 0);
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
            // P3 FIX: absolute position — PIP clips live in PIP-local time
            startTime: getClipAbsoluteStart(targetClip) + timeOffset,
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
      toast.success(`Successfully generated and auto-placed ${cuePoints.length} sound effects!`);
    } catch (err: any) {
      await handlePuterError(err, 'Auto-Cue Sound Effects');
    } finally {
      setIsAnalyzingAutoCue(false);
      setAutoCueProgress(0);
    }
  }, [sfxAutoCueClipId, sfxAutoCueMode, sfxUserDescription, tracks, mediaLibrary, addClip, setIsAnalyzingAutoCue, setAutoCueProgress, setSfxAutoCueClipId, setSfxUserDescription, getClipAbsoluteStart]);

  const handleGenerateSubtitles = useCallback(async (clipId: string, mode: 'standard' | 'dynamic') => {
    const targetClip = findClipDeep(useEditorStore.getState(), clipId)?.clip || null;
    if (!targetClip) return;

    const mediaItem = mediaLibrary.find(m => m.id === targetClip!.mediaId);
    if (!mediaItem || !mediaItem.url) {
      toast.warning('Media source file not found.');
      return;
    }

    setIsTranscribing(true);

    try {
      const response = await fetch(mediaItem.url);
      if (!response.ok) throw new Error('Failed to retrieve clip media blob.');
      const blob = await response.blob();

      // P3 FIX: the file was always named 'audio.mp3' with the RAW blob type —
      // for a video media item this uploaded the entire video (not extracted
      // audio) under a misleading name. Keep name/type consistent and honest.
      const file = new File(
        [blob],
        mediaItem.type === 'video' ? 'clip_media_track.webm' : 'clip_audio.webm',
        { type: blob.type || 'audio/webm' }
      );

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
        // P3 FIX: Whisper timestamps are relative to the FULL media start — the
        // timeline position maps to clipStart + (t − trimStart) / speed. The old
        // math (clipStart + t) offset subtitles later by trimStart seconds on any
        // trimmed clip and ignored speed entirely.
        const clipStart = targetClip.startTime;
        const trimOffset = targetClip.trimStart || 0;
        const clipSpeed = Math.max(0.01, targetClip.speed || 1);
        const toTimeline = (t: number) => clipStart + (t - trimOffset) / clipSpeed;

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
            // P3 FIX: trimStart/speed-aware mapping (see toTimeline above)
            const phraseStart = toTimeline(firstWord.start);
            const phraseEnd = toTimeline(lastWord.end);

            return {
              id: `sub_${Math.random().toString(36).substr(2, 9)}`,
              startTime: phraseStart,
              endTime: phraseEnd,
              text: phraseText,
              translations: { en: phraseText }
            };
          });

          // P3 FIX: generating subs for one clip used to REPLACE ALL project
          // subtitles (wiping other clips' subs in one undo step). Replace only
          // the target clip's range and keep the rest.
          const existingSubs = useEditorStore.getState().subtitles || [];
          const targetClipEnd = clipStart + targetClip.duration;
          const keptSubs = existingSubs.filter(
            (s: any) => s.endTime <= clipStart + 0.001 || s.startTime >= targetClipEnd - 0.001
          );
          useEditorStore.getState().setSubtitles([...keptSubs, ...newSubs]);
        } else {
          const colors = ['#ffffff', '#fbbf24', '#22c55e', '#22d3ee', '#f43f5e', '#a855f7'];
          const animations = ['zoom', 'bounce', 'slideUp'];

          for (let i = 0; i < result.words.length; i++) {
            const w = result.words[i];
            const wordText = w.word.trim();
            if (!wordText) continue;

            // P3 FIX: trimStart/speed-aware mapping (see toTimeline above)
            const wordStart = toTimeline(w.start);
            let wordDur = (w.end - w.start) / clipSpeed;
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
