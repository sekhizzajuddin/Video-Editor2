// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Used by BOTH the desktop editor (src/App.tsx → DesktopApp) and
// the mobile editor (src/mobile/App.tsx → MobileApp). There is NO separate mobile
// copy — edit ONCE here. LOGIC / ARCHITECTURE / BUGFIX changes automatically apply
// to both UIs. UI-only changes belong in the individual UI layer instead.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useRef, useEffect } from 'react';
import { ExportWorkerConfig } from './engine/export.worker';
import { ExportWorkerManager } from './engine/ExportWorkerManager';
import { ExportPhase } from './types';
import { defaultExportPipeline } from './ExportPipeline';
import { promoteCanvasToExportSize } from './exportCanvasSize';
import { useEditorStore } from '@/store/editorStore';
import { clearNormalizedCache } from './engine/VideoNormalizer';
import { setTrimPreviewTime } from '@/utils/playbackClock';

export interface Resolution {
  width: number;
  height: number;
  aspectRatio: number;
  name: string;
  maxBitrate: number;
}

export const RESOLUTION_PRESETS: Record<string, Resolution> = {
  // 16:9 Widescreen
  '16:9_4K':   { width: 3840, height: 2160, aspectRatio: 16/9, name: '4K UHD', maxBitrate: 50_000_000 },
  '16:9_1080': { width: 1920, height: 1080, aspectRatio: 16/9, name: 'Full HD', maxBitrate: 15_000_000 },
  '16:9_720':  { width: 1280, height: 720,  aspectRatio: 16/9, name: 'HD', maxBitrate: 8_000_000 },
  // 9:16 Vertical
  '9:16_4K':   { width: 2160, height: 3840, aspectRatio: 9/16, name: '4K Vertical', maxBitrate: 50_000_000 },
  '9:16_1080': { width: 1080, height: 1920, aspectRatio: 9/16, name: 'Instagram Reels', maxBitrate: 15_000_000 },
  '9:16_720':  { width: 720,  height: 1280, aspectRatio: 9/16, name: 'TikTok', maxBitrate: 8_000_000 },
  // 1:1 Square
  '1:1_4K':    { width: 2160, height: 2160, aspectRatio: 1,    name: '4K Square', maxBitrate: 40_000_000 },
  '1:1_1080':  { width: 1080, height: 1080, aspectRatio: 1,    name: 'Instagram Post', maxBitrate: 10_000_000 },
  // 4:3 Standard
  '4:3_4K':    { width: 2880, height: 2160, aspectRatio: 4/3, name: '4K Standard', maxBitrate: 40_000_000 },
  '4:3_1080':  { width: 1440, height: 1080, aspectRatio: 4/3, name: 'Standard HD', maxBitrate: 12_000_000 },
};

export interface ExportState {
  phase: ExportPhase;
  progress: number;
  currentFrame: number;
  totalFrames: number;
  fps: number;
  estimatedTimeRemaining: number;
  fileSize: number;
  warnings: string[];
  filename: string | null;
  savedViaRuntime?: boolean;
}

export function useExportEngine() {
  const [exportState, setExportState] = useState<ExportState>({
    phase: 'idle',
    progress: 0,
    currentFrame: 0,
    totalFrames: 0,
    fps: 30,
    estimatedTimeRemaining: 0,
    fileSize: 0,
    warnings: [],
    filename: null,
  });

  const exporterRef = useRef<ExportWorkerManager | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startExport = useCallback(async (config: ExportWorkerConfig, fileHandle?: FileSystemFileHandle | null) => {
    const store = useEditorStore.getState();
    if (store.isPlaying) store.pause();
    setTrimPreviewTime(null);
    store.selectSpeedFrame(null, null);

    // Guard: suppress stray unhandled rejections during export to prevent the
    // global chunk-error handler from misinterpreting them and reloading the page.
    // This catches errors from: export Worker, OfflineAudioContext, canvas ops,
    // browser extension errors (e.g. "Language detection is not supported").
    let exportActive = true;
    const exportRejectionGuard = (e: PromiseRejectionEvent) => {
      if (!exportActive) return;
      const msg = typeof e.reason === 'string' ? e.reason : (e.reason?.message || '');
      // Let genuine chunk errors through (handled by main.tsx)
      const isChunkError =
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('Expected a JavaScript-or-Wasm module script');
      if (isChunkError) return; // Don't prevent default for real chunk errors

      // Suppress all other rejections during export — they're logged but shouldn't crash
      console.warn('[Export] Suppressed unhandled rejection during export:', msg, e.reason);
      e.preventDefault();
    };
    window.addEventListener('unhandledrejection', exportRejectionGuard);

    if (exporterRef.current) {
      exporterRef.current.dispose();
      exporterRef.current = null;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const attemptWysiwygFallback = async (
      workerError: Error,
      duration: number
    ): Promise<{ filename: string; savedViaRuntime: boolean; blob: Blob } | null> => {
      // Only fallback for black-frame or decode errors — not for user cancel
      const msg = workerError.message || '';
      const isBlackOrDecodeError =
        /black frames/i.test(msg) ||
        /could not be decoded/i.test(msg) ||
        /No visual layers/i.test(msg) ||
        /GPU.*decode/i.test(msg);
      // We fallback for any worker error to guarantee WYSIWYG, except AbortError
      if (msg === 'AbortError') return null;

      console.warn('[Export] Worker failed, attempting WYSIWYG preview capture fallback:', msg);
      setExportState(prev => ({
        ...prev,
        phase: 'preparing',
        warnings: [...prev.warnings, `Worker export failed (${msg}), falling back to preview-accurate capture...`],
      }));

      try {
        const store = useEditorStore.getState();
        const previewCanvas = store.previewCanvas as HTMLCanvasElement | null;
        if (!previewCanvas) {
          throw new Error('Preview canvas not available for fallback export');
        }

        // MOBILE EXPORT FIX: capture-based backends encode the preview canvas
        // buffer as-is. Without promotion the buffer stays at the hard-coded
        // 854×480 landscape defaults (setExportDimensions was never called
        // anywhere), so e.g. a 9:16 project got letterboxed into 854×480 and
        // then stretched/recorded at the wrong size — "over-stretched, ignoring
        // the chosen project resolution" on phones. Promote the canvas to the
        // actual requested export resolution and restore it afterwards.
        const restoreCanvasSize = await promoteCanvasToExportSize(config.width, config.height);

        // Use the preview canvas which already renders exactly what user sees
        let outBlob: Blob;
        try {
        const captureResult = await defaultExportPipeline
          .start({
            width: config.width,
            height: config.height,
            fps: config.fps,
            format: (config.format === 'webm' ? 'webm' : 'mp4') as any,
            quality: 'high',
            bitrate: config.bitrate,
            startAt: config.startAt || 0,
            endAt: config.endAt || duration,
            useHardwareEncoder: true,
            canvas: previewCanvas,
            audioStream: null,
            onProgress: (p) => {
              setExportState(prev => ({
                ...prev,
                phase: p.stage === 'capturing' ? 'capturing' : p.stage === 'encoding' ? 'encoding' : 'rendering',
                progress: p.percentage,
              }));
            },
            setStatusMsg: (m) => {
              console.log('[Fallback Export]', m);
            },
          })
          .promise;
        outBlob = captureResult.blob;
        } finally {
          // Restore preview canvas to its previous size/state regardless of
          // capture success/failure (also resets the previously-leaked
          // isExporting flag).
          restoreCanvasSize();
        }

        // Save blob to OPFS (same as worker path)
        const outFileName = `${config.filename}.${config.format === 'webm' ? 'webm' : 'mp4'}`;
        let finalHandle: FileSystemFileHandle | null = fileHandle || null;
        let finalFileName = outFileName;
        if (!finalHandle) {
          const root = await navigator.storage.getDirectory();
          finalHandle = await root.getFileHandle(outFileName, { create: true });
          finalFileName = finalHandle.name;
        }
        const writable = await finalHandle.createWritable();
        await writable.write(outBlob);
        await writable.close();

        return { filename: finalFileName, savedViaRuntime: !!fileHandle, blob: outBlob };
      } catch (fallbackErr: any) {
        console.error('[Export] Fallback also failed:', fallbackErr);
        setExportState(prev => ({
          ...prev,
          warnings: [...prev.warnings, `Preview fallback failed: ${fallbackErr?.message || fallbackErr}`],
        }));
        return null;
      }
    };

    try {
      setExportState(prev => ({ ...prev, phase: 'analyzing', progress: 0, warnings: [], filename: null }));
      
      const timeline = useEditorStore.getState();
      let duration = (timeline as any).totalDuration || (timeline as any).duration || 0;
      if (!duration && timeline.tracks) {
        for (const track of timeline.tracks) {
          for (const clip of track.clips || []) {
            const end = (clip.startTime || 0) + (clip.duration || 0);
            if (end > duration) duration = end;
          }
        }
      }
      duration = Math.max(0.1, duration);
      const totalFrames = Math.ceil(duration * config.fps);
      
      setExportState(prev => ({ 
        ...prev, 
        totalFrames,
        fps: config.fps,
        phase: 'preparing' 
      }));

      const exporter = new ExportWorkerManager({
        timeline,
        config,
        fileHandle,
        callbacks: {
          onProgress: (progress, currentFrame, eta) => {
            setExportState(prev => ({
              ...prev,
              phase: 'rendering',
              progress,
              currentFrame,
              estimatedTimeRemaining: eta,
            }));
          },
          onPhaseChange: (phase) => {
            setExportState(prev => ({ ...prev, phase }));
          },
          onComplete: (fileSize) => {
            setExportState(prev => ({ 
              ...prev, 
              phase: 'completed',
              progress: 100,
              fileSize 
            }));
          },
          onError: (error) => {
            console.error('Export error:', error);
            setExportState(prev => ({ 
              ...prev, 
              phase: 'error',
              warnings: [...prev.warnings, error.message]
            }));
          },
          onWarning: (message) => {
            console.warn('Export warning:', message);
            setExportState(prev => ({
              ...prev,
              warnings: prev.warnings.includes(message) ? prev.warnings : [...prev.warnings, message]
            }));
          },
        }
      });

      exporterRef.current = exporter;
      
      try {
        const result = await exporter.export(abortController.signal);
        setExportState(prev => ({ 
          ...prev, 
          filename: result.filename,
          savedViaRuntime: result.savedViaRuntime
        }));
      } catch (workerErr: any) {
        // Try WYSIWYG fallback for any worker failure (especially black frames)
        if (workerErr?.message === 'AbortError') throw workerErr;

        const fallbackResult = await attemptWysiwygFallback(workerErr, duration);
        if (fallbackResult) {
          const fileSize = fallbackResult.blob.size;
          setExportState(prev => ({
            ...prev,
            phase: 'completed',
            progress: 100,
            fileSize,
            filename: fallbackResult.filename,
            savedViaRuntime: fallbackResult.savedViaRuntime,
          }));
          // Store blob size for download handler — reuse existing mechanism
          // by putting file in OPFS (already done) and using existing download
          return;
        }
        // No fallback succeeded → rethrow original
        throw workerErr;
      } finally {
        // Terminate the worker immediately — download() reads from OPFS, not the worker.
        // Without this, every export leaves a live worker holding decoded frames + GPU state.
        // NOTE: Do NOT null exporterRef.current here — downloadFile() needs the instance
        // to call download() after export completes. The unmount effect handles final cleanup.
        exporterRef.current?.dispose();
        clearNormalizedCache();
      }
    } catch (error) {
      if ((error as Error).message === 'AbortError') {
        setExportState(prev => ({ ...prev, phase: 'cancelled' }));
      } else {
        setExportState(prev => ({ 
          ...prev, 
          phase: 'error',
          warnings: [...prev.warnings, (error as Error).message]
        }));
      }
    } finally {
      // Always clean up the rejection guard when export finishes
      exportActive = false;
      window.removeEventListener('unhandledrejection', exportRejectionGuard);
    }
  }, []);

  const cancelExport = useCallback(() => {
    abortControllerRef.current?.abort();
    setExportState(prev => ({ ...prev, phase: 'cancelled' }));
  }, []);

  const downloadFile = useCallback(() => {
    if (exporterRef.current && exportState.filename) {
      exporterRef.current.download(exportState.filename);
    }
  }, [exportState.filename]);
  
  useEffect(() => {
    return () => {
      exporterRef.current?.dispose();
    };
  }, []);

  return {
    exportState,
    startExport,
    cancelExport,
    downloadFile,
  };
}
