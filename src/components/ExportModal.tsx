import { X, Download, Film, Sparkles, AlertCircle } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useState, useEffect, useRef, useCallback } from 'react';
import { formatSimpleTime } from '@/utils/time';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { getFFmpegSeparationArgs } from '@/utils/audioSeparation';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();

// FFmpeg singleton load state
let ffmpegLoadPromise: Promise<void> | null = null;

async function ensureFFmpegLoaded(): Promise<void> {
  if (ffmpeg.loaded) return;
  if (ffmpegLoadPromise) {
    await ffmpegLoadPromise;
    return;
  }

  ffmpegLoadPromise = (async () => {
    const coreBaseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

    ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });

    await ffmpeg.load({
      coreURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  })();

  await ffmpegLoadPromise;
}

type ExportStatus = 'idle' | 'recording' | 'converting' | 'error' | 'done';

export function ExportModal() {
  const {
    showExportModal, setShowExportModal, totalDuration, tracks,
    previewCanvas, masterAudioStream, seek, isPlaying, togglePlayback, currentTime,
    inPoint, outPoint
  } = useEditorStore();

  const [fps, setFps] = useState('30');
  const [quality, setQuality] = useState('high');
  const [exportFormat, setExportFormat] = useState<'mp4' | 'webm'>('mp4');
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const isExporting = exportStatus === 'recording' || exportStatus === 'converting';

  // Cleanup function: stop recorder, revoke streams, clear timers
  const cleanup = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      try {
        recorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    recorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((t) => t.stop());
      videoStreamRef.current = null;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    chunksRef.current = [];
  }, []);

  // Watch currentTime to update progress and stop recording at out point
  useEffect(() => {
    if (exportStatus !== 'recording') return;

    const startAt = inPoint !== null ? inPoint : 0;
    const endAt = outPoint !== null ? outPoint : totalDuration;
    const duration = Math.max(0.1, endAt - startAt);
    const elapsed = Math.max(0, currentTime - startAt);
    const p = Math.min(100, (elapsed / duration) * 100);
    setProgress(p);

    // Hard stop at out point
    if (currentTime >= endAt) {
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop();
      }
      if (isPlaying) {
        togglePlayback();
      }
      setExportStatus('idle');
    }
  }, [currentTime, totalDuration, exportStatus, isPlaying, togglePlayback, inPoint, outPoint]);

  // Cleanup on unmount or when modal closes
  useEffect(() => {
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showExportModal) {
      cleanup();
      setExportStatus('idle');
      setProgress(0);
      setConversionProgress(0);
      setErrorMsg(null);
    }
  }, [showExportModal, cleanup]);

  // Guard against double-click and concurrent exports using ref
  const isExportingRef = useRef(false);

  const handleCancel = useCallback(() => {
    cleanup();
    if (isPlaying) togglePlayback();
    isExportingRef.current = false;
    setExportStatus('idle');
    setProgress(0);
    setConversionProgress(0);
  }, [cleanup, isPlaying, togglePlayback]);

  const handleExport = async () => {
    if (isExportingRef.current) return;
    isExportingRef.current = true;
    if (!previewCanvas || !masterAudioStream) {
      setErrorMsg('Canvas or Audio stream not initialized yet.');
      isExportingRef.current = false;
      return;
    }

    const startAt = inPoint !== null ? inPoint : 0;
    const endAt = outPoint !== null ? outPoint : totalDuration;
    if (endAt <= startAt) {
      setErrorMsg('Invalid in/out points. Please set a valid range.');
      isExportingRef.current = false;
      return;
    }

    // Reset state
    cleanup();
    chunksRef.current = [];
    setExportStatus('recording');
    setProgress(0);
    setConversionProgress(0);
    setErrorMsg(null);

    // Create video stream from canvas
    const videoStream = previewCanvas.captureStream(parseInt(fps));
    videoStreamRef.current = videoStream;

    const combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...masterAudioStream.getAudioTracks()
    ]);
    streamRef.current = combinedStream;

    // Select optimal mimeType
    const mimeTypeCandidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    let mimeType = mimeTypeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';

    const bitsPerSecond =
      quality === 'max' ? 12_000_000 : quality === 'high' ? 6_000_000 : 3_000_000;

    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: bitsPerSecond,
    });

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = async () => {
      isExportingRef.current = false;
      // Stop tracks to free resources
      videoStream.getTracks().forEach((t) => t.stop());
      combinedStream.getTracks().forEach((t) => t.stop());
      videoStreamRef.current = null;
      streamRef.current = null;

      if (chunksRef.current.length === 0) {
        setErrorMsg('Recording produced no data. Please try again.');
        setExportStatus('error');
        return;
      }

      const webmBlob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = []; // free memory

      if (exportFormat === 'webm') {
        triggerDownload(webmBlob, 'webm');
        setExportStatus('done');
        setTimeout(() => {
          setShowExportModal(false);
          setExportStatus('idle');
        }, 500);
        return;
      }

      // MP4 conversion via FFmpeg WASM
      setExportStatus('converting');
      try {
        await convertToMp4(webmBlob);
        setExportStatus('done');
        setTimeout(() => {
          setShowExportModal(false);
          setExportStatus('idle');
        }, 500);
      } catch (err: any) {
        console.error('FFmpeg WASM MP4 export failed, downloading WebM fallback:', err);
        if (err?.message === 'Aborted') {
          setErrorMsg('Export was cancelled.');
          setExportStatus('error');
        } else {
          setErrorMsg('MP4 conversion failed. Downloading WebM fallback.');
          triggerDownload(webmBlob, 'webm');
          setExportStatus('error');
        }
      }
    };

    recorder.onerror = (e) => {
      console.error('MediaRecorder error:', e);
      setErrorMsg('Recording error occurred. Please try again.');
      setExportStatus('error');
      cleanup();
    };

    recorderRef.current = recorder;

    // Seek to start and begin
    seek(startAt);

    // Start recorder with timeslice to stream in chunks (prevents memory bloat)
    timeoutRef.current = setTimeout(() => {
      if (!recorderRef.current) return;
      try {
        recorder.start(1000); // timeslice 1s to periodically flush data
        // Manually drive playback if not already playing
        if (!useEditorStore.getState().isPlaying) {
          togglePlayback();
        }
      } catch (err) {
        console.error('Failed to start MediaRecorder:', err);
        setErrorMsg('Failed to start recording. Please try again.');
        setExportStatus('error');
        cleanup();
      }
    }, 300);
  };

  const convertToMp4 = async (webmBlob: Blob) => {
    abortControllerRef.current = new AbortController();
    setConversionProgress(0);

    // Load FFmpeg (cached if already loaded)
    await ensureFFmpegLoaded();

    // Setup progress
    ffmpeg.on('progress', ({ progress: p }) => {
      setConversionProgress(Math.min(100, Math.round(p * 100)));
    });

    // Write input
    const inputData = await fetchFile(webmBlob);
    await ffmpeg.writeFile('input.webm', inputData);

    // Build args with optimized settings
    const separationArgs: string[] = [];
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (clip.audioSettings?.vocalSeparation?.enabled) {
          const sepArgs = getFFmpegSeparationArgs(clip.audioSettings.vocalSeparation);
          separationArgs.push(...sepArgs);
        }
      }
    }

    // optimized: faster preset gives better speed/size balance than ultrafast
    const ffmpegArgs = [
      '-i', 'input.webm',
      '-c:v', 'libx264',
      '-preset', 'faster',
      '-crf', quality === 'max' ? '18' : quality === 'high' ? '22' : '28',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      ...separationArgs,
      '-c:a', 'aac',
      '-b:a', '128k',
      'output.mp4'
    ];

    // Exec with timeout guard
    const execPromise = ffmpeg.exec(ffmpegArgs);
    const timeoutPromise = new Promise<void>((_, reject) => {
      const timer = setTimeout(() => reject(new Error('FFmpeg conversion timed out')), 10 * 60 * 1000); // 10 min max
      abortControllerRef.current?.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error('Aborted'));
      });
    });

    await Promise.race([execPromise, timeoutPromise]);

    // Read output
    const outputData = await ffmpeg.readFile('output.mp4');
    const mp4Blob = new Blob([outputData as any], { type: 'video/mp4' });

    triggerDownload(mp4Blob, 'mp4');

    // Cleanup virtual files
    try { await ffmpeg.deleteFile('input.webm'); } catch { /* ignore */ }
    try { await ffmpeg.deleteFile('output.mp4'); } catch { /* ignore */ }
  };

  const triggerDownload = (blob: Blob, ext: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `procut-export-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  const totalClips = tracks.reduce((acc, t) => acc + t.clips.length, 0);

  // Estimated file size (rough)
  const getEstimatedSize = () => {
    const duration = (outPoint !== null ? outPoint : totalDuration) - (inPoint !== null ? inPoint : 0);
    if (duration <= 0) return '—';
    const bits = quality === 'max' ? 12_000_000 : quality === 'high' ? 6_000_000 : 3_000_000;
    const sizeBytes = (duration * bits) / 8;
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(0)} KB`;
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!showExportModal) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center">
      <div className="bg-[#2d2d2d] rounded-lg shadow-2xl w-[480px] max-h-[90vh] overflow-y-auto border border-[#3e3e3e]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#3e3e3e]">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Export Video</h2>
          </div>
          <button
            onClick={() => isExporting ? handleCancel() : setShowExportModal(false)}
            disabled={false}
            className="p-1 text-[#a0a0a0] hover:text-white rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Error Banner */}
          {errorMsg && (
            <div className="bg-red-900/30 border border-red-500/40 rounded p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-200 leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {/* Project Info */}
          <div className="bg-[#252525] rounded p-3 border border-[#3e3e3e]">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[#a0a0a0]">Duration: </span>
                <span className="text-white">{formatSimpleTime(totalDuration)}</span>
              </div>
              <div>
                <span className="text-[#a0a0a0]">Clips: </span>
                <span className="text-white">{totalClips}</span>
              </div>
              <div>
                <span className="text-[#a0a0a0]">Tracks: </span>
                <span className="text-white">{tracks.length}</span>
              </div>
              <div>
                <span className="text-[#a0a0a0]">Render Resolution: </span>
                <span className="text-white">854 x 480 (16:9)</span>
              </div>
              <div>
                <span className="text-[#a0a0a0]">Est. File Size: </span>
                <span className="text-white">{getEstimatedSize()}</span>
              </div>
            </div>
          </div>

          {/* Export Format Selector */}
          <div>
            <label className="text-xs text-[#a0a0a0] block mb-2">Export Format</label>
            <div className="flex gap-2">
              {[
                { id: 'mp4', label: 'MP4 (H.264 + AAC)', desc: 'Max Compatibility' },
                { id: 'webm', label: 'WebM (VP9 + Opus)', desc: 'Direct / Raw' },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  disabled={isExporting}
                  onClick={() => setExportFormat(fmt.id as any)}
                  className={`flex-1 px-3 py-2 rounded text-xs border transition-colors text-left ${
                    exportFormat === fmt.id
                      ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                      : 'bg-[#252525] border-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:border-[#a0a0a0] disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  <div className="font-semibold">{fmt.label}</div>
                  <div className="text-[9px] opacity-60 mt-0.5">{fmt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Frame Rate */}
          <div>
            <label className="text-xs text-[#a0a0a0] block mb-2">Frame Rate</label>
            <div className="flex gap-2">
              {['24', '30', '60'].map((f) => (
                <button
                  key={f}
                  disabled={isExporting}
                  onClick={() => setFps(f)}
                  className={`px-4 py-2 rounded text-xs border transition-colors ${
                    fps === f
                      ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                      : 'bg-[#252525] border-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:border-[#a0a0a0] disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  {f} fps
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div>
            <label className="text-xs text-[#a0a0a0] block mb-2">Quality Preset</label>
            <div className="flex gap-2">
              {[
                { id: 'draft', label: 'Draft', desc: 'Fast render' },
                { id: 'high', label: 'High', desc: 'Balanced quality' },
                { id: 'max', label: 'Maximum', desc: 'Slow / High bitrate' },
              ].map((q) => (
                <button
                  key={q.id}
                  disabled={isExporting}
                  onClick={() => setQuality(q.id)}
                  className={`flex-1 px-3 py-2 rounded text-xs border transition-colors text-left ${
                    quality === q.id
                      ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                      : 'bg-[#252525] border-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:border-[#a0a0a0] disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  <div className="font-semibold">{q.label}</div>
                  <div className="text-[9px] opacity-60 mt-0.5">{q.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Recording Progress */}
          {exportStatus === 'recording' && (
            <div className="bg-[#252525] rounded p-3 border border-[#3e3e3e]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white">Rendering Timeline...</span>
                <span className="text-xs text-amber-400">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-[#3e3e3e] rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* FFmpeg Conversion Progress */}
          {exportStatus === 'converting' && (
            <div className="bg-[#252525] rounded p-3 border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  <span className="text-xs text-white font-medium">Assembling H.264 MP4 Container...</span>
                </div>
                <span className="text-xs text-amber-400">{conversionProgress}%</span>
              </div>
              <div className="h-2 bg-[#3e3e3e] rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-200"
                  style={{ width: `${conversionProgress}%` }}
                />
              </div>
              <p className="text-[9px] text-[#a0a0a0] leading-relaxed">
                FFmpeg WASM is encoding raw frames. Please keep this tab active to allow hardware acceleration.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#3e3e3e]">
          {isExporting ? (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-xs text-red-400 hover:text-red-300 transition-colors border border-red-400/30 rounded"
            >
              Cancel Export
            </button>
          ) : (
            <button
              onClick={() => setShowExportModal(false)}
              className="px-4 py-2 text-xs text-[#a0a0a0] hover:text-white transition-colors"
            >
              Close
            </button>
          )}
          <button
            onClick={isExporting ? handleCancel : handleExport}
            disabled={isExporting && exportStatus !== 'recording'}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-[#3e3e3e] disabled:cursor-not-allowed text-white text-xs rounded flex items-center gap-1.5 transition-colors font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            {exportStatus === 'recording'
              ? 'Recording...'
              : exportStatus === 'converting'
              ? 'Encoding MP4...'
              : exportStatus === 'error'
              ? 'Retry Export'
              : exportStatus === 'done'
              ? 'Done'
              : 'Start Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
