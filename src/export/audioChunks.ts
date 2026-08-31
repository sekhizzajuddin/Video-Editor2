import { useEditorStore } from '../store/editorStore';
import { getMediaTimeForClip } from '../utils/speedRamp';

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

        const source = offlineCtx.createBufferSource();
        source.buffer = decodedBuffer;
        
        // Calculate volume scaling
        const gainNode = offlineCtx.createGain();
        const linearGain = Math.pow(10, volumeDb / 20);
        const storeLinearGain = store.volume ?? 1;
        // Clamp just like in preview player to prevent clipping
        gainNode.gain.value = Math.max(0, Math.min(1, linearGain * storeLinearGain));
        
        // Apply static speed (for speedRamps, this is just the base speed)
        source.playbackRate.value = clip.speed || 1;
        
        source.connect(gainNode);
        gainNode.connect(offlineCtx.destination);

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
          source.start(scheduleTime, offset, playDuration);
          hasActiveAudio = true;
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
