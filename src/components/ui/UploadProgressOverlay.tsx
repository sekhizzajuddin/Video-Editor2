import React from 'react';
import { Loader2, FileUp, Sparkles } from 'lucide-react';

export interface UploadProgressOverlayProps {
  isDragging: boolean;
  isUploading: boolean;
  progressText?: string;
  progressPercent?: number;
  fileName?: string;
}

export function UploadProgressOverlay({
  isDragging,
  isUploading,
  progressText = 'Importing media...',
  progressPercent = 0,
  fileName,
}: UploadProgressOverlayProps) {
  if (!isDragging && !isUploading) return null;

  return (
    <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-sm border-2 border-dashed border-amber-500/80 flex items-center justify-center rounded-lg transition-all duration-200 animate-in fade-in-0 pointer-events-auto">
      {isDragging ? (
        <div className="text-center p-6 bg-background rounded-xl border border-amber-500/40 shadow-2xl scale-105 transition-transform max-w-xs">
          <div className="w-14 h-14 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3 border border-amber-500/30">
            <FileUp className="w-8 h-8 text-amber-400 animate-bounce" />
          </div>
          <p className="text-base font-bold text-amber-300">Drop files to Import</p>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Supports Video (MP4, WEBM), Audio (MP3, WAV), & Images
          </p>
          <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-amber-400/80 font-medium">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Automatic indexing & waveform probing</span>
          </div>
        </div>
      ) : isUploading ? (
        <div className="text-center p-6 bg-card rounded-xl border border-border shadow-2xl w-80">
          <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">{progressText}</p>
          {fileName && (
            <p className="text-xs text-muted-foreground truncate mb-3 px-2 py-1 bg-background rounded border border-border">
              {fileName}
            </p>
          )}
          <div className="w-full bg-background h-2 rounded-full overflow-hidden border border-border">
            <div
              className="bg-gradient-to-r from-amber-600 to-amber-400 h-full transition-all duration-200"
              style={{ width: `${Math.max(5, progressPercent)}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-muted-foreground/80 mt-2 font-mono">
            <span>Processing buffers...</span>
            <span className="text-amber-400 font-bold">{Math.round(progressPercent)}%</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
