import { useEditorStore } from '../store/editorStore';
import { getMediaTimeForClip, getSpeedFrameSegments } from '../utils/speedRamp';
import { generateReverbImpulse } from '../utils/reverbDsp';

export interface AudioExportOptions {
  startAt: number;
  endAt: number;
  sampleRate: number;
}

/**
 * Extracts and renders timeline audio offline into pristine AudioData blocks for WebCodecs AudioEncoder.
 * Eliminates real-time audio dropout bugs caused by manual video frame stepping during offline rendering.
 */
export async function* streamAudioChunks(opts: AudioExportOptions): AsyncGenerator<AudioData, void, unknown> {
  if (typeof window.OfflineAudioContext === 'undefined' || typeof window.AudioData === 'undefined') {
    return;
  }

  const store = useEditorStore.getState();
  const tracks = store.tracks || [];
  const mediaLibrary = store.mediaLibrary || [];
  const duration = Math.max(0.1, opts.endAt - opts.startAt);
  const totalSamples = Math.ceil(duration * opts.sampleRate);

  const offlineCtx = new window.OfflineAudioContext(2, totalSamples, opts.sampleRate);
  let hasActiveAudio = false;

  for (const track of tracks) {
    if (track.muted || track.hidden || store.muteTimelineAudio || (track.type !== 'video' && track.type !== 'audio')) {
      continue;
    }

    for (const clip of (track.clips || [])) {
      const isMuted = clip.audioSettings?.muted || clip.disabled;
      const volumeDb = clip.audioSettings?.volume ?? 0;
      if (isMuted || volumeDb <= -40) continue;

      // Check temporal intersection with export duration
      const clipEnd = clip.startTime + clip.duration;
      if (clipEnd <= opts.startAt || clip.startTime >= opts.endAt) continue;

      const media = mediaLibrary.find((m) => m.id === clip.mediaId || m.url === clip.mediaId);
      const url = media ? media.url : (clip as any).url || (clip as any).src;
      if (!url) continue;

      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const decodedBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

        // Calculate volume scaling
        const gainNode = offlineCtx.createGain();
        const linearGain = Math.pow(10, volumeDb / 20);
        const storeLinearGain = store.volume ?? 1;
        // Clamp just like in preview player to prevent clipping
        gainNode.gain.value = Math.max(0, Math.min(1, linearGain * storeLinearGain));

        const reverb = clip.audioSettings?.reverb;
        if (reverb?.enabled && (reverb.mix ?? 0) > 0) {
          const wetFrac = Math.max(0, Math.min(1, reverb.mix / 100));
          const dryGain = offlineCtx.createGain();
          const wetGain = offlineCtx.createGain();
          dryGain.gain.value = Math.cos(wetFrac * Math.PI * 0.5);
          wetGain.gain.value = Math.sin(wetFrac * Math.PI * 0.5);

          const convolver = offlineCtx.createConvolver();
          convolver.buffer = generateReverbImpulse(
            offlineCtx,
            reverb.decay ?? 1.5,
            reverb.damping ?? 40,
            reverb.preDelay ?? 20,
            reverb.roomSize ?? 50
          );

          gainNode.connect(dryGain);
          gainNode.connect(convolver);
          convolver.connect(wetGain);
          dryGain.connect(offlineCtx.destination);
          wetGain.connect(offlineCtx.destination);
        } else {
          gainNode.connect(offlineCtx.destination);
        }
        
        const speedSegments = (clip.speedFrames && clip.speedFrames.length > 0)
          ? getSpeedFrameSegments(clip, decodedBuffer.duration)
          : null;

        if (speedSegments && speedSegments.length > 0) {
          for (const seg of speedSegments) {
            const segTimelineStart = clip.startTime + seg.startOffset;
            const segTimelineEnd = clip.startTime + seg.endOffset;
            if (segTimelineEnd <= opts.startAt || segTimelineStart >= opts.endAt) continue;

            const segScheduleTime = Math.max(0, segTimelineStart - opts.startAt);
            const segPlayStart = Math.max(opts.startAt, segTimelineStart);
            const dtFromSegStart = segPlayStart - segTimelineStart;
            const segSpeed = seg.speed || 1;
            const segSourceOffset = Math.max(0, seg.sourceStart + dtFromSegStart * segSpeed);
            if (segSourceOffset >= decodedBuffer.duration) continue;

            const maxAvail = Math.max(0, decodedBuffer.duration - segSourceOffset);
            const segBufferDuration = Math.min(
              maxAvail,
              Math.max(0, (Math.min(segTimelineEnd, opts.endAt) - segPlayStart) * segSpeed)
            );

            if (segBufferDuration > 0.0001) {
              try {
                const segSource = offlineCtx.createBufferSource();
                segSource.buffer = decodedBuffer;
                segSource.playbackRate.value = segSpeed;
                segSource.connect(gainNode);
                segSource.start(segScheduleTime, segSourceOffset, segBufferDuration);
                hasActiveAudio = true;
              } catch (segErr) {
                console.warn('[audioChunks] Failed to schedule segment:', segErr);
              }
            }
          }
        } else {
          const source = offlineCtx.createBufferSource();
          source.buffer = decodedBuffer;
          source.playbackRate.value = clip.speed || 1;
          source.connect(gainNode);

          // Calculate precise trim and timeline placement
          const scheduleTime = Math.max(0, clip.startTime - opts.startAt);
          const timelinePlayStart = Math.max(opts.startAt, clip.startTime);
          
          // Use the exact media time math rather than a simple addition that breaks on speed/splits
          const offset = getMediaTimeForClip(
            {
              id: clip.id,
              startTime: clip.startTime,
              duration: clip.duration,
              trimStart: clip.trimStart,
              speed: clip.speed || 1,
              speedRamp: clip.speedRamp
            },
            timelinePlayStart
          );
          
          const playDuration = Math.min(clip.duration, duration - scheduleTime);

          if (playDuration > 0) {
            source.start(scheduleTime, offset, playDuration * (clip.speed || 1));
            hasActiveAudio = true;
          }
        }
      } catch (err) {
        console.warn(`[AudioExport] Could not decode audio for clip ${media?.name || clip.id}:`, err);
      }
    }
  }

  if (!hasActiveAudio) {
    return;
  }

  // Synchronously render combined mixdown in background
  const renderedBuffer = await offlineCtx.startRendering();
  const numChannels = renderedBuffer.numberOfChannels;
  const sampleRate = renderedBuffer.sampleRate;
  const length = renderedBuffer.length;

  // De-interleave and slice into clean 1024-sample AAC frames
  const frameSize = 1024;
  const numFrames = Math.ceil(length / frameSize);

  for (let i = 0; i < numFrames; i++) {
    const startSample = i * frameSize;
    const currentFrameSize = Math.min(frameSize, length - startSample);
    const channelData = new Float32Array(numChannels * currentFrameSize);

    for (let c = 0; c < numChannels; c++) {
      const channelBuffer = renderedBuffer.getChannelData(c);
      for (let s = 0; s < currentFrameSize; s++) {
        channelData[c * currentFrameSize + s] = channelBuffer[startSample + s];
      }
    }

    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate: sampleRate,
      numberOfFrames: currentFrameSize,
      numberOfChannels: numChannels,
      timestamp: Math.floor((startSample * 1_000_000) / sampleRate),
      data: channelData,
    });

    yield audioData;
  }
}
