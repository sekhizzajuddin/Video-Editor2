/**
 * Core type definitions for modular export pipelines and encoder backends.
 */

export type EncoderBackendType = 'webcodecs' | 'webm-webcodecs' | 'ffmpeg' | 'mediarecorder';

export interface ExportOptions {
  width: number;
  height: number;
  fps: number;
  format: 'mp4' | 'webm';
  quality: 'ultra' | 'high' | 'medium' | 'low';
  bitrate?: number;
  startAt: number;
  endAt: number;
  useHardwareEncoder: boolean;
  canvas: HTMLCanvasElement | null;
  audioStream: MediaStream | null;
  onProgress: (progress: ExportProgress) => void;
  setStatusMsg?: (msg: string) => void;
}

export interface ExportProgress {
  stage: 'preparing' | 'capturing' | 'encoding' | 'muxing' | 'complete' | 'error';
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
