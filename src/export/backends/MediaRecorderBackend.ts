import { EncoderBackend, EncoderBackendType, ExportOptions } from '../types';
import { useEditorStore } from '../../store/editorStore';
import { getLiveAudioStream } from '../../hooks/useMediaPlayback';

export class MediaRecorderBackend implements EncoderBackend {
  readonly type: EncoderBackendType = 'mediarecorder';
  readonly name = 'MediaRecorder Legacy Streaming Encoder';
  private recorder: MediaRecorder | null = null;
  private cancelled = false;

  cancel(): void {
    this.cancelled = true;
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
  }

  async isSupported(opts: ExportOptions): Promise<boolean> {
    // MediaRecorder is our dependable software fallback only for mp4 and webm
    if (opts.format !== 'mp4' && opts.format !== 'webm') {
      return false;
    }
    return typeof window.MediaRecorder !== 'undefined';
  }

  async export(opts: ExportOptions): Promise<Blob> {
    this.cancelled = false;
    const store = useEditorStore.getState();
    const duration = Math.max(0.1, opts.endAt - opts.startAt);

    if (!opts.canvas) {
      throw new Error('Canvas element not found for MediaRecorder capture');
    }

    opts.setStatusMsg?.('Preparing software real-time stream capture...');
    opts.onProgress({ stage: 'preparing', percentage: 5, message: 'Setting up stream capture...' });

    // Ensure audio stream is live and cloned to avoid stale handles (Issue 1)
    const liveAudio = await getLiveAudioStream();
    const canvasStream = opts.canvas.captureStream(opts.fps || 30);

    const tracks: MediaStreamTrack[] = [
      ...canvasStream.getVideoTracks(),
      ...(liveAudio ? liveAudio.getAudioTracks() : [])
    ];
    const combinedStream = new MediaStream(tracks);

    // Respect requested format
    const candidates = opts.format === 'mp4' 
      ? ['video/mp4'] 
      : [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm'
        ];
    const mimeType = candidates.find((c) => MediaRecorder.isTypeSupported(c)) || (opts.format === 'mp4' ? 'video/mp4' : 'video/webm');

    const chunks: Blob[] = [];
    return new Promise<Blob>((resolve, reject) => {
      try {
        this.recorder = new MediaRecorder(combinedStream, {
          mimeType,
          videoBitsPerSecond: opts.bitrate || 5_000_000,
        });

        this.recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        this.recorder.onerror = (e: any) => {
          reject(new Error(`MediaRecorder error: ${e.error || e.message || 'unknown error'}`));
        };

        this.recorder.onstop = () => {
          if (this.cancelled) {
            reject(new Error('Export cancelled by user.'));
            return;
          }
          opts.onProgress({ stage: 'complete', percentage: 100, message: 'Stream capture complete.' });
          const outBlob = new Blob(chunks, { type: mimeType });
          resolve(outBlob);
        };

        // Start playback and recording synchronously
        store.seek(opts.startAt);
        if (!store.isPlaying) {
          store.play();
        }

        this.recorder.start(250);
        opts.onProgress({ stage: 'capturing', percentage: 10, message: 'Recording real-time video stream...' });

        // Monitor playback duration for completion
        const startTime = performance.now();
        const checkInterval = setInterval(() => {
          if (this.cancelled) {
            clearInterval(checkInterval);
            if (store.isPlaying) store.pause();
            return;
          }

          const elapsed = (performance.now() - startTime) / 1000;
          const currentProgress = Math.min(95, Math.floor((elapsed / duration) * 100));
          opts.onProgress({
            stage: 'capturing',
            percentage: currentProgress,
            message: `Recording: ${currentProgress}% (${Math.floor(elapsed)}s/${Math.floor(duration)}s)`,
          });

          if (elapsed >= duration || store.currentTime >= opts.endAt) {
            clearInterval(checkInterval);
            if (store.isPlaying) store.pause();
            if (this.recorder && this.recorder.state !== 'inactive') {
              this.recorder.stop();
            }
          }
        }, 300);

      } catch (err) {
        reject(err);
      }
    });
  }
}
