import { useState, useCallback, useRef, useEffect } from 'react';
import { WysiwygExportEngine, WysiwygExportConfig } from './engine/WysiwygExportEngine';
import { ExportPhase } from './types';
import { useEditorStore } from '@/store/editorStore';

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
  currentTime: number;
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
    currentTime: 0,
    fps: 30,
    estimatedTimeRemaining: 0,
    fileSize: 0,
    warnings: [],
    filename: null,
  });

  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);
  const exportedBlobRef = useRef<Blob | null>(null);
  const engineRef = useRef<WysiwygExportEngine | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startExport = useCallback(async (config: WysiwygExportConfig, fileHandle?: FileSystemFileHandle | null) => {
    if (engineRef.current) {
      engineRef.current.cancel();
      engineRef.current = null;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    exportedBlobRef.current = null;

    try {
      const store = useEditorStore.getState();
      let duration = (store as any).totalDuration || (store as any).duration || 0;
      if (!duration && store.tracks) {
        for (const track of store.tracks) {
          for (const clip of track.clips || []) {
            const end = (clip.startTime || 0) + (clip.duration || 0);
            if (end > duration) duration = end;
          }
        }
      }
      duration = Math.max(0.1, duration);
      const totalFrames = Math.ceil(duration * config.fps);

      setExportState({
        phase: 'preparing',
        progress: 0,
        currentFrame: 0,
        totalFrames,
        currentTime: 0,
        fps: config.fps,
        estimatedTimeRemaining: 0,
        fileSize: 0,
        warnings: [],
        filename: null,
      });

      const engine = new WysiwygExportEngine(
        config,
        {
          onProgress: (progress, currentFrame, eta) => {
            setExportState(prev => ({
              ...prev,
              progress,
              currentFrame,
              estimatedTimeRemaining: eta,
            }));
          },
          onPhaseChange: (phase) => {
            setExportState(prev => ({ ...prev, phase }));
          },
          onPreviewFrame: (canvas, currentFrame, totalFrames, currentTime) => {
            setPreviewCanvas(canvas);
            setExportState(prev => ({
              ...prev,
              currentFrame,
              totalFrames,
              currentTime,
            }));
          },
          onComplete: (fileSize, filename, blob) => {
            exportedBlobRef.current = blob;
            setExportState(prev => ({
              ...prev,
              phase: 'completed',
              progress: 100,
              fileSize,
              filename,
            }));
          },
          onError: (error) => {
            console.error('[ExportEngine] Export failed:', error);
            setExportState(prev => ({
              ...prev,
              phase: 'error',
              warnings: [...prev.warnings, error.message || String(error)],
            }));
          },
          onWarning: (message) => {
            console.warn('[ExportEngine] Warning:', message);
            setExportState(prev => ({
              ...prev,
              warnings: prev.warnings.includes(message) ? prev.warnings : [...prev.warnings, message],
            }));
          },
        },
        fileHandle
      );

      engineRef.current = engine;
      const result = await engine.export(abortController.signal);

      exportedBlobRef.current = result.blob;
      setExportState(prev => ({
        ...prev,
        phase: 'completed',
        progress: 100,
        fileSize: result.blob.size,
        filename: result.filename,
        savedViaRuntime: result.savedViaRuntime,
      }));
    } catch (error: any) {
      if (error?.message === 'AbortError' || abortController.signal.aborted) {
        setExportState(prev => ({ ...prev, phase: 'cancelled' }));
      } else {
        setExportState(prev => ({
          ...prev,
          phase: 'error',
          warnings: [...prev.warnings, error?.message || 'Export error occurred'],
        }));
      }
    }
  }, []);

  const cancelExport = useCallback(() => {
    abortControllerRef.current?.abort();
    engineRef.current?.cancel();
    setExportState(prev => ({ ...prev, phase: 'cancelled' }));
  }, []);

  const downloadFile = useCallback(() => {
    if (exportedBlobRef.current) {
      const url = URL.createObjectURL(exportedBlobRef.current);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportState.filename || 'export.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  }, [exportState.filename]);

  useEffect(() => {
    return () => {
      engineRef.current?.cancel();
    };
  }, []);

  return {
    exportState,
    previewCanvas,
    startExport,
    cancelExport,
    downloadFile,
  };
}
