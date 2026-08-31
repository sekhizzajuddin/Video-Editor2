import React, { useState, useCallback, useRef, DragEvent } from 'react';
import { Film, X, UploadCloud, Video, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';

export interface ClipDropZoneProps {
  onClipDrop: (url: string, name: string, duration: number) => void;
  selectedClipName: string | null;
  selectedClipUrl: string | null;
  selectedClipDuration?: number;
  onRemove?: () => void;
}

export const ClipDropZone: React.FC<ClipDropZoneProps> = ({
  onClipDrop,
  selectedClipName,
  selectedClipUrl,
  selectedClipDuration = 0,
  onRemove,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [libraryItems, setLibraryItems] = useState<
    Array<{ id: string; name: string; duration: number; url: string }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /** Loads usable clips straight from the media library (no dragging needed). */
  const openLibraryPicker = useCallback(async () => {
    try {
      const { useEditorStore } = await import('@/store/editorStore');
      const items = useEditorStore
        .getState()
        .mediaLibrary.filter(
          (m) => (m.type === 'video' || m.type === 'audio') && Number(m.duration || 0) <= 30
        )
        .map((m) => ({
          id: m.id,
          name: m.name || 'Media',
          duration: Number(m.duration || 0),
          url: m.url,
        }));
      setLibraryItems(items);
      if (items.length === 0) {
        toast.info('No clips under 30s in the media library yet — import one first.');
      }
    } catch (err) {
      console.warn('[ClipDropZone] Failed to read media library:', err);
    }
  }, []);

  const handleFilePick = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
        toast.error('Please choose a video or audio file');
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      const probe = document.createElement('video');
      probe.preload = 'metadata';
      probe.muted = true;
      const finish = (duration: number) => {
        if (duration > 30) {
          toast.error('Clip must be 30 seconds or less');
          URL.revokeObjectURL(objectUrl);
          return;
        }
        onClipDrop(objectUrl, file.name, duration);
      };
      probe.onloadedmetadata = () => finish(probe.duration || 0);
      probe.onerror = () => {
        toast.error('Could not read that media file');
        URL.revokeObjectURL(objectUrl);
      };
      probe.src = objectUrl;
    },
    [onClipDrop]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      // 1. Check for MediaPanel dragging format: application/procut-media or window.__procutDraggingMediaId
      const procutMediaId =
        e.dataTransfer.getData('application/procut-media') ||
        (window as any).__procutDraggingMediaId;

      if (procutMediaId) {
        try {
          const { useEditorStore } = await import('@/store/editorStore');
          const mediaItem = useEditorStore.getState().mediaLibrary.find((m) => m.id === procutMediaId);
          if (mediaItem) {
            const duration = Number(mediaItem.duration || 0);
            if (duration > 30) {
              toast.error('Clip must be 30 seconds or less');
              return;
            }
            onClipDrop(mediaItem.url, mediaItem.name || 'Media Clip', duration);
            return;
          }
        } catch (err) {
          console.warn('[ClipDropZone] Error reading media item from store:', err);
        }
      }

      // 2. Check for serialized JSON clip data
      const procutData = e.dataTransfer.getData('application/procut-clip-data');
      if (procutData) {
        try {
          const parsed = JSON.parse(procutData);
          const url = parsed.url || parsed.mediaUrl || parsed.item?.url || '';
          const name = parsed.name || parsed.clipName || parsed.item?.name || 'Dropped Clip';
          const duration = Number(parsed.duration ?? parsed.item?.duration ?? 0);

          if (!url) {
            toast.error('Invalid clip data dropped');
            return;
          }

          if (duration > 30) {
            toast.error('Clip must be 30 seconds or less');
            return;
          }

          onClipDrop(url, name, duration);
          return;
        } catch {
          toast.error('Failed to parse dropped clip data');
        }
      }

      // Check text/plain fallback
      const textData = e.dataTransfer.getData('text/plain');
      if (textData) {
        try {
          const parsed = JSON.parse(textData);
          if (parsed.url) {
            const duration = Number(parsed.duration || 0);
            if (duration > 30) {
              toast.error('Clip must be 30 seconds or less');
              return;
            }
            onClipDrop(parsed.url, parsed.name || 'Dropped Clip', duration);
            return;
          }
        } catch {
          // not JSON, ignore
        }
      }

      // Check files
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
          const objectUrl = URL.createObjectURL(file);
          const videoElement = document.createElement('video');
          videoElement.src = objectUrl;
          videoElement.onloadedmetadata = () => {
            const duration = videoElement.duration || 0;
            if (duration > 30) {
              toast.error('Clip must be 30 seconds or less');
              URL.revokeObjectURL(objectUrl);
              return;
            }
            onClipDrop(objectUrl, file.name, duration);
          };
          videoElement.onerror = () => {
            toast.error('Could not load dropped media file');
            URL.revokeObjectURL(objectUrl);
          };
          return;
        }
      }

      toast.error('Please drop a valid video/audio clip from the Media Panel');
    },
    [onClipDrop]
  );

  if (selectedClipUrl) {
    return (
      <div className="relative rounded-xl border border-border bg-background p-4 transition hover:border-amber-400/60 group">
        <div className="flex items-center gap-4">
          <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-black flex-shrink-0 border border-border flex items-center justify-center">
            <video
              src={selectedClipUrl}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <Video className="w-5 h-5 text-foreground/80" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground truncate" title={selectedClipName || 'Selected Clip'}>
              {selectedClipName || 'Selected Clip'}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20">
                {selectedClipDuration > 0 ? `${selectedClipDuration.toFixed(1)}s` : 'Video Clip'}
              </span>
              <span className="text-xs text-muted-foreground">Ready for motion graphics</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onRemove ? onRemove : () => onClipDrop('', '', 0)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-secondary transition-colors"
            title="Remove clip"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-xl border border-dashed p-6 transition-all flex flex-col items-center justify-center text-center ${
        isDragOver
          ? 'border-amber-400 bg-amber-400/5 scale-[0.99]'
          : 'border-border bg-background hover:border-amber-400'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*"
        className="hidden"
        onChange={(e) => {
          handleFilePick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center mb-3">
        {isDragOver ? (
          <UploadCloud className="w-6 h-6 text-amber-400 animate-bounce" />
        ) : (
          <Film className="w-6 h-6 text-amber-400" />
        )}
      </div>

      <p className="text-sm font-medium text-foreground mb-1">
        Drop a clip here <span className="text-amber-400 font-semibold">(max 30s)</span>
      </p>
      <p className="text-xs text-muted-foreground mb-3">
        or drag from Media Panel / drop a video file
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary text-foreground border border-border hover:border-amber-400 hover:text-amber-400 transition-colors"
        >
          Browse files
        </button>
        <button
          type="button"
          onClick={openLibraryPicker}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary text-muted-foreground border border-border hover:border-amber-400 hover:text-amber-400 transition-colors flex items-center gap-1.5"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Media library
        </button>
      </div>

      {libraryItems.length > 0 && (
        <select
          className="mt-3 w-full bg-background border border-border rounded-lg text-xs text-foreground px-2 py-1.5 focus:outline-none focus:border-amber-400"
          defaultValue=""
          onChange={(e) => {
            const item = libraryItems.find((i) => i.id === e.target.value);
            if (item) {
              onClipDrop(item.url, item.name, item.duration);
              setLibraryItems([]);
            }
          }}
        >
          <option value="" disabled>
            Select a clip ({libraryItems.length} under 30s)
          </option>
          {libraryItems.map((item) => (
            <option key={item.id} value={item.id} className="bg-background text-foreground">
              {item.name} • {item.duration.toFixed(1)}s
            </option>
          ))}
        </select>
      )}
    </div>
  );
};
