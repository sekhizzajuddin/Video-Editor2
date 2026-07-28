import { X, Download, Sparkles, AlertCircle } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { useState, useEffect, useRef, useCallback } from 'react';
import { formatSimpleTime } from '@/utils/time';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { toast } from 'sonner';
import { defaultExportPipeline } from '@/export/ExportPipeline';

const ffmpeg = new FFmpeg();

// FFmpeg singleton load state
let ffmpegLoadPromise: Promise<void> | null = null;
let ffmpegLogs: string[] = [];
let ffmpegLogHandlerRegistered = false;

const ffmpegLogHandler = ({ message }: { message: string }) => {
  ffmpegLogs.push(message);
  if (ffmpegLogs.length > 200) ffmpegLogs.shift();
  if (import.meta.env.DEV) console.log('[FFmpeg]', message);
};

async function ensureFFmpegLoaded(): Promise<void> {
  if (ffmpeg.loaded) return;
  if (ffmpegLoadPromise) {
    await ffmpegLoadPromise;
    return;
  }

  ffmpegLoadPromise = (async () => {
    // Use toBlobURL to fetch from same origin — this converts the files to blob: URLs
    // which FFmpeg's worker can load correctly without COEP/CORS issues
    const baseURL = window.location.origin + '/ffmpeg';

    if (!ffmpegLogHandlerRegistered) {
      ffmpeg.on('log', ffmpegLogHandler);
      ffmpegLogHandlerRegistered = true;
    }

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  })();

  try {
    await ffmpegLoadPromise;
  } catch (err) {
    ffmpegLoadPromise = null; // Allow retry on next attempt
    throw err;
  }
}

type ExportStatus = 'idle' | 'recording' | 'converting' | 'error' | 'done';

export function ExportModal() {
  const {
    showExportModal, setShowExportModal, totalDuration, tracks,
    previewCanvas, masterAudioStream, seek, isPlaying, togglePlayback, currentTime,
    inPoint, outPoint, setIsExporting, setExportFps, setExportDimensions, aspectRatio
  } = useEditorStore(useShallow(s => ({
    showExportModal: s.showExportModal, setShowExportModal: s.setShowExportModal, totalDuration: s.totalDuration, tracks: s.tracks,
    previewCanvas: s.previewCanvas, masterAudioStream: s.masterAudioStream, seek: s.seek, isPlaying: s.isPlaying, togglePlayback: s.togglePlayback, currentTime: s.currentTime,
    inPoint: s.inPoint, outPoint: s.outPoint, setIsExporting: s.setIsExporting, setExportFps: s.setExportFps, setExportDimensions: s.setExportDimensions, aspectRatio: s.aspectRatio
  })));

  const [fps, setFps] = useState('30');
  const [quality, setQuality] = useState('high');
  const [exportFormat, setExportFormat] = useState<'mp4' | 'webm'>('webm'); // Default to webm — most reliable
  const [useHardwareEncoder, setUseHardwareEncoder] = useState<boolean>(true);
  const [resolution, setResolution] = useState('720p');
  const [batchTargets, setBatchTargets] = useState<('16:9' | '9:16' | '1:1' | '4:3')[]>(['16:9']);
  const batchTargetsRef = useRef<string[]>(['16:9']);
  useEffect(() => { batchTargetsRef.current = batchTargets; }, [batchTargets]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const currentBatchIndexRef = useRef<number>(0);
  useEffect(() => { currentBatchIndexRef.current = currentBatchIndex; }, [currentBatchIndex]);
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [platform, setPlatform] = useState<'local' | 'youtube' | 'tiktok'>('local');

  useEffect(() => {
    if (showExportModal) {
      setBatchTargets([aspectRatio]);
      setCurrentBatchIndex(0);
    }
  }, [showExportModal, aspectRatio]);
  const [progress, setProgress] = useState(0);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>('');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const batchTimeoutsRef = useRef<any[]>([]);

  // Refs for values that onstop callback needs without stale closures
  const exportFormatRef = useRef(exportFormat);
  const mimeTypeRef = useRef('video/webm');
  const exportStatusRef = useRef<ExportStatus>('idle');
  const isExportingRef = useRef(false);
  const playbackStartedRef = useRef(false);

  useEffect(() => { exportFormatRef.current = exportFormat; }, [exportFormat]);

  const isExporting = exportStatus === 'recording' || exportStatus === 'converting';

  const updateStatus = useCallback((s: ExportStatus) => {
    exportStatusRef.current = s;
    setExportStatus(s);
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (!recorderRef.current && !streamRef.current && !videoStreamRef.current && !timeoutRef.current && batchTimeoutsRef.current.length === 0 && !abortControllerRef.current && !useEditorStore.getState().isExporting) {
      return;
    }
    if (recorderRef.current) {
      recorderRef.current.ondataavailable = null;
      recorderRef.current.onstop = null;
      recorderRef.current.onerror = null;
      if (recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch { /* ignore */ }
      }
    }
    recorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((t) => t.stop());
      videoStreamRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    batchTimeoutsRef.current.forEach((t) => clearTimeout(t));
    batchTimeoutsRef.current = [];

    try {
      if (ffmpeg.loaded) {
        ffmpeg.terminate();
        ffmpegLoadPromise = null;
      }
    } catch (_) {}


    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    chunksRef.current = [];
    playbackStartedRef.current = false;
    // FIX M12: restore canvas BEFORE calling setIsExporting(false) to avoid flicker
    if (previewCanvas && useEditorStore.getState().isExporting) {
      const previewWidth = useEditorStore.getState().settings.previewQuality === 'quarter' ? 213 : useEditorStore.getState().settings.previewQuality === 'half' ? 427 : 854;
      const previewHeight = useEditorStore.getState().settings.previewQuality === 'quarter' ? 120 : useEditorStore.getState().settings.previewQuality === 'half' ? 240 : 480;
      previewCanvas.width = previewWidth;
      previewCanvas.height = previewHeight;
    }
    if (useEditorStore.getState().isExporting) {
      setIsExporting(false);
    }
  }, [setIsExporting, previewCanvas]);

  // Watch currentTime to update progress and stop recording at end
  useEffect(() => {
    if (exportStatusRef.current !== 'recording') {
      playbackStartedRef.current = false;
      return;
    }

    if (isPlaying) {
      playbackStartedRef.current = true;
    }

    const startAt = inPoint !== null ? inPoint : 0;
    const endAt = outPoint !== null ? outPoint : totalDuration;
    const duration = Math.max(0.1, endAt - startAt);
    const elapsed = Math.max(0, currentTime - startAt);
    const p = Math.min(100, (elapsed / duration) * 100);
    setProgress(p);

    const shouldStop = 
      (currentTime >= endAt) || 
      (playbackStartedRef.current && !isPlaying);

    // Stop at out point — ONLY stop the recorder; onstop handles the rest
    if (shouldStop && recorderRef.current && recorderRef.current.state === 'recording') {
      if (import.meta.env.DEV) console.log('[Export] Stopping recorder. currentTime:', currentTime, 'endAt:', endAt, 'isPlaying:', isPlaying);
      recorderRef.current.stop();
      if (isPlaying) togglePlayback();
    }
  }, [currentTime, totalDuration, exportStatus, isPlaying, togglePlayback, inPoint, outPoint]);

  // Cleanup on unmount
  useEffect(() => () => { cleanup(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup when modal is closed
  useEffect(() => {
    if (!showExportModal && (exportStatusRef.current === 'idle' || exportStatusRef.current === 'done' || exportStatusRef.current === 'error')) {
      cleanup();
      updateStatus('idle');
      setProgress(0);
      setConversionProgress(0);
      setErrorMsg(null);
    }
  }, [showExportModal, cleanup, updateStatus]);

  const handleCancel = useCallback(() => {
    cleanup();
    if (isPlaying) togglePlayback();
    isExportingRef.current = false;
    setIsExporting(false);
    updateStatus('idle');
    setProgress(0);
    setConversionProgress(0);
    setStatusMsg('');
  }, [cleanup, isPlaying, togglePlayback, updateStatus, setIsExporting]);

  const triggerDownload = (blob: Blob, ext: string) => {
    const suffix = batchTargetsRef.current.length > 1 ? batchTargetsRef.current[currentBatchIndexRef.current].replace(':', 'x') : '';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `procut-export-${Date.now()}${suffix ? '-' + suffix : ''}.${ext}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 200);
  };

  const convertToMp4 = async (webmBlob: Blob, hasAudio: boolean): Promise<void> => {
    abortControllerRef.current = new AbortController();
    setConversionProgress(0);
    ffmpegLogs = []; // Clear logs for this run

    setStatusMsg('Loading FFmpeg engine (first time may take ~30s)...');
    await ensureFFmpegLoaded();
    if (abortControllerRef.current?.signal.aborted) throw new Error('Aborted');

    // Pre-clean virtual FS
    for (const f of ['input.webm', 'output.mp4']) {
      try { await ffmpeg.deleteFile(f); } catch { /* not present */ }
    }

    setStatusMsg('Preparing input...');
    const inputData = await fetchFile(webmBlob);
    await ffmpeg.writeFile('input.webm', inputData);

    // FFmpeg args — ultrafast preset, ensure even dimensions
    const ffmpegArgs = [
      '-i', 'input.webm',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', quality === 'max' ? '18' : quality === 'high' ? '22' : '28',
      '-pix_fmt', 'yuv420p',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-movflags', '+faststart',
    ];

    if (hasAudio) {
      ffmpegArgs.push('-c:a', 'aac', '-b:a', '128k');
    } else {
      ffmpegArgs.push('-an');
    }

    ffmpegArgs.push('-shortest', '-y', 'output.mp4');

    const progressHandler = ({ progress: p }: { progress: number }) => {
      const pct = Math.min(99, Math.round(p * 100));
      setConversionProgress(pct);
      setStatusMsg(`Encoding H.264... ${pct}%`);
    };
    ffmpeg.on('progress', progressHandler);

    setStatusMsg('Encoding video...');
    let execRet = -1;
    try {
      execRet = await ffmpeg.exec(ffmpegArgs);
    } finally {
      ffmpeg.off('progress', progressHandler);
    }

    if (abortControllerRef.current?.signal.aborted) throw new Error('Aborted');

    if (execRet !== 0) {
      const lastLogs = ffmpegLogs.slice(-10).join('\n');
      for (const f of ['input.webm', 'output.mp4']) {
        try { await ffmpeg.deleteFile(f); } catch { /* ignore */ }
      }
      ffmpegLoadPromise = null;
      throw new Error(`FFmpeg exited with code ${execRet}.\n${lastLogs}`);
    }

    setStatusMsg('Reading output...');
    setConversionProgress(99);

    let outputData: Uint8Array | string;
    try {
      outputData = await ffmpeg.readFile('output.mp4');
    } catch {
      ffmpegLoadPromise = null;
      throw new Error('FFmpeg produced no output file');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mp4Blob = new Blob([outputData as any], { type: 'video/mp4' });
    if (mp4Blob.size < 1000) {
      throw new Error('Output MP4 is too small — encoding likely failed silently');
    }

    triggerDownload(mp4Blob, 'mp4');
    setConversionProgress(100);

    for (const f of ['input.webm', 'output.mp4']) {
      try { await ffmpeg.deleteFile(f); } catch { /* ignore */ }
    }
  };

  const handleExport = async () => {
    if (isExportingRef.current) return;
    isExportingRef.current = true;

    if (!previewCanvas) {
      setErrorMsg('Canvas not initialized. Please wait for the preview to load.');
      isExportingRef.current = false;
      return;
    }

    const startAt = inPoint !== null ? inPoint : 0;
    const endAt = outPoint !== null ? outPoint : totalDuration;

    if (endAt <= startAt || totalDuration <= 0) {
      setErrorMsg('No content to export. Please add clips to the timeline.');
      isExportingRef.current = false;
      return;
    }

    // Reset state
    cleanup();
    chunksRef.current = [];

    // Calculate export dimensions based on resolution and aspect ratio
    const height = resolution === '4k' ? 2160 : resolution === '1080p' ? 1080 : resolution === '720p' ? 720 : 480;
    const currentAspectRatio = batchTargetsRef.current[currentBatchIndexRef.current] || batchTargetsRef.current[0] || '16:9';
    let width = 854;
    if (currentAspectRatio === '16:9') {
      width = Math.round(height * (16 / 9));
    } else if (currentAspectRatio === '9:16') {
      width = Math.round(height * (9 / 16));
    } else if (currentAspectRatio === '1:1') {
      width = height;
    } else if (currentAspectRatio === '4:3') {
      width = Math.round(height * (4 / 3));
    }

    // Force synchronous resize on DOM element to prevent capture stream mismatch
    previewCanvas.width = width;
    previewCanvas.height = height;

    // Set export settings in Zustand store
    setExportDimensions(width, height);
    setIsExporting(true);
    setExportFps(parseInt(fps));
    updateStatus('recording');
    setProgress(0);
    setConversionProgress(0);
    setErrorMsg(null);
    setStatusMsg('Preparing...');

    // Check if WebCodecs hardware GPU encoding can process this MP4 export instantaneously
    if (exportFormat === 'mp4' && useHardwareEncoder) {
      const bitsPerSecond = quality === 'max' ? 12_000_000 : quality === 'high' ? 6_000_000 : 3_000_000;
      const pipelineOpts = {
        width,
        height,
        fps: parseInt(fps),
        format: 'mp4' as const,
        quality: quality as any,
        bitrate: bitsPerSecond,
        startAt,
        endAt,
        useHardwareEncoder: true,
        canvas: previewCanvas,
        audioStream: masterAudioStream,
        onProgress: (prog: any) => {
          setProgress(prog.percentage);
          if (prog.message) setStatusMsg(prog.message);
        },
        setStatusMsg,
      };

      const selectedBackend = await defaultExportPipeline.selectBestBackend(pipelineOpts);
      if (selectedBackend.type === 'webcodecs') {
        try {
          const { promise } = defaultExportPipeline.start(pipelineOpts);
          const result = await promise;
          triggerDownload(result.blob, 'mp4');
          updateStatus('done');
          setStatusMsg('MP4 export complete (WebCodecs GPU)!');
          isExportingRef.current = false;
          setIsExporting(false);

          const tId = setTimeout(() => {
            if (currentBatchIndexRef.current < batchTargetsRef.current.length - 1) {
              setCurrentBatchIndex(prev => prev + 1);
              updateStatus('idle');
              setIsExporting(false);
              const tId2 = setTimeout(() => {
                useEditorStore.getState().setAspectRatio(batchTargetsRef.current[currentBatchIndexRef.current] as any);
                const tId3 = setTimeout(() => handleExport(), 500);
                batchTimeoutsRef.current.push(tId3);
              }, 100);
              batchTimeoutsRef.current.push(tId2);
            } else {
              setShowExportModal(false);
              setIsExporting(false);
              updateStatus('idle');
              setCurrentBatchIndex(0);
            }
          }, 2000);
          batchTimeoutsRef.current.push(tId);
          return;
        } catch (err: any) {
          console.warn('[Export] WebCodecs GPU encoding exception, failing over to standard stream recorder...', err);
        }
      }
    }

    // Create video stream from canvas
    const videoStream = previewCanvas.captureStream(parseInt(fps));
    videoStreamRef.current = videoStream;

    // Audio is optional
    let combinedStream: MediaStream;
    // FIX M10: capture hasAudio in a ref so the stale closure in onstop reads the correct value
    const hasAudio = !!(masterAudioStream && masterAudioStream.getAudioTracks().length > 0);
    const hasAudioRef = { current: hasAudio };
    if (hasAudio) {
      combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...masterAudioStream!.getAudioTracks()
      ]);
    } else {
      combinedStream = new MediaStream([...videoStream.getVideoTracks()]);
    }
    streamRef.current = combinedStream;

    // Select mimeType — prefer VP8 for better FFmpeg compatibility
    const mimeTypeCandidates = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp8',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp9',
      'video/webm',
    ];
    const mimeType = mimeTypeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';
    mimeTypeRef.current = mimeType;
    if (import.meta.env.DEV) console.log('[Export] Using MIME type:', mimeType, 'Audio:', hasAudio);

    const bitsPerSecond = quality === 'max' ? 12_000_000 : quality === 'high' ? 6_000_000 : 3_000_000;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: bitsPerSecond,
      });
    } catch (err) {
      console.error('MediaRecorder creation failed:', err);
      setErrorMsg('Recording not supported in this browser.');
      updateStatus('error');
      cleanup();
      isExportingRef.current = false;
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    // The onstop handler is the CRITICAL path — it processes the recording
    recorder.onstop = async () => {
      videoStream.getTracks().forEach((t) => t.stop());
      combinedStream.getVideoTracks().forEach((t) => t.stop());
      videoStreamRef.current = null;
      streamRef.current = null;

      const chunks = chunksRef.current;
      chunksRef.current = [];

      if (chunks.length === 0) {
        setIsExporting(false);
        setErrorMsg('Recording produced no data. Play the timeline once before exporting.');
        updateStatus('error');
        isExportingRef.current = false;
        return;
      }

      // Create the WebM blob
      const webmBlob = new Blob(chunks, { type: mimeTypeRef.current });
      if (import.meta.env.DEV) console.log('[Export] WebM blob size:', (webmBlob.size / 1024).toFixed(1), 'KB, chunks:', chunks.length);
      setProgress(100);

      if (webmBlob.size < 1000) {
        setIsExporting(false);
        setErrorMsg('Recording is too small — the canvas may not have rendered any frames. Try playing the timeline first.');
        updateStatus('error');
        isExportingRef.current = false;
        return;
      }

      // Read current format preference from ref (avoids stale closure)
      const fmt = exportFormatRef.current;

      if (fmt === 'webm') {
        triggerDownload(webmBlob, 'webm');
        updateStatus('done');
        setStatusMsg('Download started!');
        isExportingRef.current = false;
        setIsExporting(false);
        const tId = setTimeout(() => {
          if (exportStatusRef.current === 'done') {
            if (currentBatchIndexRef.current < batchTargetsRef.current.length - 1) {
              // Start next batch!
              setCurrentBatchIndex(prev => prev + 1);
              updateStatus('idle');
              setIsExporting(false);
              const tId2 = setTimeout(() => {
                useEditorStore.getState().setAspectRatio(batchTargetsRef.current[currentBatchIndexRef.current] as any);
                const tId3 = setTimeout(() => handleExport(), 500); // Give canvas time to resize
                batchTimeoutsRef.current.push(tId3);
              }, 100);
              batchTimeoutsRef.current.push(tId2);
            } else {
              setShowExportModal(false);
              setIsExporting(false);
              updateStatus('idle');
              setCurrentBatchIndex(0);
            }
          }
        }, 2000);
        batchTimeoutsRef.current.push(tId);
        return;
      }

      // MP4 conversion
      updateStatus('converting');
      
      try {
        if (webmBlob.type.includes('mp4')) {
          if (import.meta.env.DEV) console.log('[Export] Native MP4 generated by hardware encoder, skipping FFmpeg!');
          setStatusMsg('Saving hardware-encoded MP4...');
          triggerDownload(webmBlob, 'mp4');
        } else {
          setStatusMsg('Starting MP4 conversion...');
          // FIX M10: use hasAudioRef.current instead of stale closure variable
          await convertToMp4(webmBlob, hasAudioRef.current);
        }
        updateStatus('done');
        setStatusMsg('MP4 export complete!');
        isExportingRef.current = false;
        setIsExporting(false);
        const tId = setTimeout(() => {
          if (exportStatusRef.current === 'done') {
            if (currentBatchIndexRef.current < batchTargetsRef.current.length - 1) {
              // Start next batch!
              setCurrentBatchIndex(prev => prev + 1);
              updateStatus('idle');
              setIsExporting(false);
              const tId2 = setTimeout(() => {
                useEditorStore.getState().setAspectRatio(batchTargetsRef.current[currentBatchIndexRef.current] as any);
                const tId3 = setTimeout(() => handleExport(), 500); // Give canvas time to resize
                batchTimeoutsRef.current.push(tId3);
              }, 100);
              batchTimeoutsRef.current.push(tId2);
            } else {
              setShowExportModal(false);
              setIsExporting(false);
              updateStatus('idle');
              setCurrentBatchIndex(0);
            }
          }
        }, 2000);
        batchTimeoutsRef.current.push(tId);
      } catch (err: any) {
        console.error('FFmpeg MP4 export failed:', err);
        isExportingRef.current = false;
        setIsExporting(false);

        if (err?.message === 'Aborted') {
          updateStatus('idle');
          setStatusMsg('');
          return;
        }

        // FFmpeg failed — offer WebM as fallback download
        setErrorMsg(`MP4 conversion failed: ${err?.message?.substring(0, 100) ?? 'unknown'}. Downloading WebM instead.`);
        updateStatus('error');
        triggerDownload(webmBlob, 'webm');
      }
    };

    recorder.onerror = (e) => {
      console.error('MediaRecorder error:', e);
      setErrorMsg('Recording error. Please try again.');
      updateStatus('error');
      isExportingRef.current = false;
      cleanup();
    };

    recorderRef.current = recorder;

    // Seek to start position
    seek(startAt);

    // Wait for seek to settle, then start recording
    // KEY: Do NOT use timeslice — record everything in one go for a clean WebM file
    timeoutRef.current = setTimeout(() => {
      if (!recorderRef.current) return;
      try {
        // Double-check we're at the right position
        const state = useEditorStore.getState();
        if (Math.abs(state.currentTime - startAt) > 1) {
          state.seek(startAt);
        }

        recorder.start(); // NO timeslice — all data comes at once in onstop
        setStatusMsg('Recording timeline...');
        if (import.meta.env.DEV) console.log('[Export] Recording started');

        // Start playback
        if (!useEditorStore.getState().isPlaying) {
          togglePlayback();
        }
      } catch (err) {
        console.error('Failed to start MediaRecorder:', err);
        setErrorMsg('Failed to start recording.');
        updateStatus('error');
        isExportingRef.current = false;
        cleanup();
      }
    }, 500); // 500ms to ensure seek completes
  };

  const totalClips = tracks.reduce((acc, t) => acc + t.clips.length, 0);

  const getEstimatedSize = () => {
    const duration = (outPoint !== null ? outPoint : totalDuration) - (inPoint !== null ? inPoint : 0);
    if (duration <= 0) return '—';
    let bits = quality === 'max' ? 12_000_000 : quality === 'high' ? 6_000_000 : 3_000_000;
    
    // Add 192kbps for audio if audio tracks are present
    const hasAudio = tracks.some(t => t.type === 'audio');
    if (hasAudio) {
      bits += 192_000;
    }

    const sizeBytes = (duration * bits) / 8;
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(0)} KB (may vary)`;
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB (may vary)`;
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
              <p className="text-xs text-red-200 leading-relaxed whitespace-pre-wrap">{errorMsg}</p>
            </div>
          )}

          {/* Platform Selection */}
          <div className="flex bg-[#252525] rounded p-1 border border-[#3e3e3e]">
            <button
              onClick={() => setPlatform('local')}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${platform === 'local' ? 'bg-[#3e3e3e] text-white' : 'text-[#a0a0a0] hover:text-[#d0d0d0]'}`}
            >Local Export</button>
            <button
              onClick={() => {
                setPlatform('youtube');
                toast.info('Selected YouTube preset optimization');
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${platform === 'youtube' ? 'bg-red-600/90 text-white' : 'text-[#a0a0a0] hover:text-[#d0d0d0]'}`}
            >YouTube</button>
            <button
              onClick={() => {
                setPlatform('tiktok');
                toast.info('Selected TikTok vertical optimization');
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${platform === 'tiktok' ? 'bg-cyan-600/90 text-white' : 'text-[#a0a0a0] hover:text-[#d0d0d0]'}`}
            >TikTok</button>
          </div>

          {platform !== 'local' && (
            <div className={`p-2.5 rounded text-xs border ${platform === 'youtube' ? 'bg-red-950/20 border-red-500/30 text-red-200' : 'bg-cyan-950/20 border-cyan-500/30 text-cyan-200'} flex items-center gap-2`}>
              <span className="text-sm font-semibold">{platform === 'youtube' ? '📺' : '📱'}</span>
              <p className="flex-1 leading-snug">
                {platform === 'youtube'
                  ? 'Applies YouTube / Shorts codec recommendations (H.264/AAC, standard high color bitrate). Export file locally for studio upload; direct OAuth publish is scheduled in Roadmap.'
                  : 'Applies TikTok vertical optimization (9:16 target formatting, loudness normalization). Export file locally; direct TikTok API upload is scheduled in Roadmap.'}
              </p>
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
                <span className="text-[#a0a0a0]">Resolution: </span>
                <span className="text-white">
                  {(() => {
                    const currentAspect = batchTargets[0] || '16:9';
                    const height = resolution === '4k' ? 2160 : resolution === '1080p' ? 1080 : resolution === '720p' ? 720 : 480;
                    let width = 854;
                    if (currentAspect === '16:9') width = Math.round(height * (16 / 9));
                    else if (currentAspect === '9:16') width = Math.round(height * (9 / 16));
                    else if (currentAspect === '1:1') width = height;
                    else if (currentAspect === '4:3') width = Math.round(height * (4 / 3));
                    return `${width} x ${height} (${batchTargets.length > 1 ? 'Multiple' : currentAspect})`;
                  })()}
                </span>
              </div>
              <div>
                <span className="text-[#a0a0a0]">Est. Size: </span>
                <span className="text-white">{getEstimatedSize()}</span>
              </div>
              <div>
                <span className="text-[#a0a0a0]">Audio: </span>
                <span className={masterAudioStream && masterAudioStream.getAudioTracks().length > 0 ? 'text-green-400' : 'text-yellow-400'}>
                  {masterAudioStream && masterAudioStream.getAudioTracks().length > 0 ? 'Ready' : 'Video only'}
                </span>
              </div>
            </div>
          </div>

          {/* Export Format */}
          <div>
            <label className="text-xs text-[#a0a0a0] block mb-2">Export Format</label>
            <div className="flex gap-2">
              {[
                { id: 'webm', label: 'WebM (VP8 + Opus)', desc: 'Recommended — Fast & Reliable' },
                { id: 'mp4', label: 'MP4 (H.264 + AAC)', desc: 'Slower — Needs FFmpeg WASM' },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  disabled={isExporting}
                  onClick={() => setExportFormat(fmt.id as any)}
                  aria-pressed={exportFormat === fmt.id}
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
            {/* Hardware GPU Acceleration Option */}
            {exportFormat === 'mp4' && typeof window.VideoEncoder !== 'undefined' && (
              <div className="mt-2.5 flex items-center gap-2 px-3 py-2 bg-zinc-900/70 border border-zinc-800/80 rounded-md">
                <input
                  type="checkbox"
                  id="hardware-encoder"
                  checked={useHardwareEncoder}
                  disabled={isExporting}
                  onChange={(e) => setUseHardwareEncoder(e.target.checked)}
                  className="w-3.5 h-3.5 accent-amber-500 rounded cursor-pointer"
                />
                <label htmlFor="hardware-encoder" className="text-xs text-zinc-300 cursor-pointer flex-1">
                  Use native GPU Hardware Encoder (<span className="text-amber-400 font-semibold">WebCodecs</span>)
                </label>
              </div>
            )}
          </div>

          {/* Resolution & Aspect Ratio */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#a0a0a0] block mb-2">Resolution</label>
              <select
                disabled={isExporting}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full bg-[#252525] text-white text-xs border border-[#3e3e3e] rounded px-3 py-2 focus:outline-none focus:border-amber-500 cursor-pointer disabled:opacity-40"
              >
                <option value="480p">480p SD (854x480)</option>
                <option value="720p">720p HD (1280x720)</option>
                <option value="1080p">1080p Full HD (1920x1080)</option>
                <option value="4k">4K Ultra HD (3840x2160)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[#a0a0a0] block mb-2">Aspect Ratio(s)</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: '16:9', label: '16:9 (YouTube)' },
                  { id: '9:16', label: '9:16 (Shorts)' },
                  { id: '1:1', label: '1:1 (Insta)' },
                  { id: '4:3', label: '4:3 (Classic)' }
                ].map(ar => (
                  <button
                    key={ar.id}
                    disabled={isExporting}
                    onClick={() => {
                      if (batchTargets.includes(ar.id as any)) {
                        if (batchTargets.length > 1) {
                          setBatchTargets(batchTargets.filter(t => t !== ar.id));
                        }
                      } else {
                        setBatchTargets([...batchTargets, ar.id as any]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                      batchTargets.includes(ar.id as any)
                        ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                        : 'bg-[#252525] border-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:border-[#a0a0a0] disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                  >
                    {ar.label}
                  </button>
                ))}
              </div>
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
            <label className="text-xs text-[#a0a0a0] block mb-2">Quality</label>
            <div className="flex gap-2">
              {[
                { id: 'draft', label: 'Draft', desc: 'Fast' },
                { id: 'high', label: 'High', desc: 'Balanced' },
                { id: 'max', label: 'Maximum', desc: 'Slow' },
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

          {/* Info */}
          {exportStatus === 'idle' && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded p-3">
              <p className="text-[10px] text-blue-200 leading-relaxed">
                <strong>Tip:</strong> Export records your timeline in real time.
                A 1-minute video takes ~1 minute. Keep this tab active.
                {exportFormat === 'mp4' && ' MP4 conversion adds extra time for encoding.'}
                {batchTargets.length > 1 && <span className="block mt-1 font-bold text-amber-300">You are batch exporting to {batchTargets.length} different formats.</span>}
              </p>
            </div>
          )}

          {/* Recording Progress */}
          {exportStatus === 'recording' && (
            <div className="bg-[#252525] rounded p-3 border border-[#3e3e3e] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-xs text-white">Recording...</span>
                </div>
                <span className="text-xs text-amber-400">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-[#3e3e3e] rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
              {statusMsg && <p className="text-[9px] text-[#a0a0a0]">{statusMsg}</p>}
            </div>
          )}

          {/* FFmpeg Conversion Progress */}
          {exportStatus === 'converting' && (
            <div className="bg-[#252525] rounded p-3 border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  <span className="text-xs text-white font-medium">Converting to MP4...</span>
                </div>
                <span className="text-xs text-amber-400">{conversionProgress}%</span>
              </div>
              <div className="h-2 bg-[#3e3e3e] rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all duration-200" style={{ width: `${conversionProgress}%` }} />
              </div>
              {statusMsg && <p className="text-[9px] text-[#a0a0a0]">{statusMsg}</p>}
            </div>
          )}

          {exportStatus === 'done' && (
            <div className="bg-green-900/20 border border-green-500/30 rounded p-3">
              <p className="text-xs text-green-300 font-medium">✓ Export complete! File downloaded.</p>
            </div>
          )}
        </div>

        {/* FIX M11: Separate Cancel and Export buttons with clear, non-contradictory labels */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#3e3e3e]">
          {isExporting ? (
            <button onClick={handleCancel} className="px-4 py-2 text-xs text-red-400 hover:text-red-300 border border-red-400/30 rounded transition-colors">
              Cancel Export
            </button>
          ) : (
            <button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-xs text-[#a0a0a0] hover:text-white transition-colors">
              Close
            </button>
          )}
          <button
            onClick={() => {
              if (batchTargets.length > 0 && aspectRatio !== batchTargets[0]) {
                 useEditorStore.getState().setAspectRatio(batchTargets[0] as any);
                 setTimeout(handleExport, 500);
              } else {
                 handleExport();
              }
            }}
            disabled={isExporting || totalClips === 0}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-[#3e3e3e] disabled:cursor-not-allowed text-white text-xs rounded flex items-center gap-1.5 font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {exportStatus === 'recording' ? 'Recording...'
              : exportStatus === 'converting' ? 'Encoding...'
              : exportStatus === 'error' ? 'Retry Export'
              : exportStatus === 'done' ? 'Done ✓'
              : 'Start Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
