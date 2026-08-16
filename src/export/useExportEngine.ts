import { useState, useCallback, useRef, useEffect } from 'react';
import { ExportWorkerConfig } from './engine/export.worker';
import { ExportWorkerManager } from './engine/ExportWorkerManager';
import { ExportPhase } from './types';

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

import { useEditorStore } from '@/store/editorStore';

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
    if (exporterRef.current) {
      exporterRef.current.dispose();
      exporterRef.current = null;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

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
      
      const result = await exporter.export(abortController.signal);
      
      setExportState(prev => ({ 
        ...prev, 
        filename: result.filename,
        savedViaRuntime: result.savedViaRuntime
      }));
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
