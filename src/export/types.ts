/**
 * Core type definitions for modular export pipelines and encoder backends.
 */

export type EncoderBackendType = 'webcodecs' | 'webm-webcodecs' | 'ffmpeg' | 'mediarecorder' | 'gif' | 'prores';

export interface ExportOptions {
  width: number;
  height: number;
  fps: number;
  format: 'mp4' | 'webm' | 'gif' | 'prores' | 'wav';
  proresProfile?: 'proxy' | 'lt' | 'standard' | 'hq' | '4444';
  quality: 'ultra' | 'high' | 'medium' | 'low';
  bitrate?: number;
  startAt: number;
  endAt: number;
  useHardwareEncoder: boolean;
  transparentBackground?: boolean;
  canvas: HTMLCanvasElement | null;
  audioStream: MediaStream | null;
  onProgress: (progress: ExportProgress) => void;
  setStatusMsg?: (msg: string) => void;
}

export type ExportPhase = 
  | 'idle' 
  | 'analyzing' 
  | 'preparing' 
  | 'capturing'
  | 'rendering' 
  | 'encoding'
  | 'muxing' 
  | 'finalizing' 
  | 'completed' 
  | 'complete'
  | 'cancelled' 
  | 'error';

export interface ExportProgress {
  stage: ExportPhase;
  percentage: number; // 0 to 100
  message?: string;
}

export interface FrameSource {
  canvas: HTMLCanvasElement;
  fps: number;
  startAt: number;
  endAt: number;
}

export interface EncoderBackend {
  readonly type: EncoderBackendType;
  readonly name: string;
  isSupported(opts: ExportOptions): Promise<boolean>;
  export(opts: ExportOptions): Promise<Blob>;
  cancel(): void;
}
