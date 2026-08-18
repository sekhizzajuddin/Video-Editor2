// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Used by BOTH the desktop editor (src/App.tsx → DesktopApp) and
// the mobile editor (src/mobile/App.tsx → MobileApp). There is NO separate mobile
// copy — edit ONCE here. LOGIC / ARCHITECTURE / BUGFIX changes automatically apply
// to both UIs. UI-only changes belong in the individual UI layer instead.
// ─────────────────────────────────────────────────────────────────────────────


import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { probeFile } from '@/utils/mediaProbe';
import { saveFileToDB } from '@/utils/projectPersistence';
import { storeMediaHandle } from '@/utils/mediaFileHandle';
import { MediaItem } from '@/types';
import { useEditorStore } from '@/store/editorStore';

export function useMediaImport() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progressText, setProgressText] = useState('Importing media...');
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const addMedia = useEditorStore(state => state.addMedia);

  const processFiles = async (
    files: File[],
    handles?: (FileSystemFileHandle | null)[],
  ) => {
    if (files.length === 0) return;
    setIsUploading(true);
    setProgressPercent(5);
    let successCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setCurrentFileName(file.name);
        setProgressText(`Importing ${i + 1} of ${files.length}: ${file.name}`);
        setProgressPercent(Math.round(((i + 0.2) / files.length) * 100));

        if (!file.type.startsWith('video/') && !file.type.startsWith('audio/') && !file.type.startsWith('image/')) {
          toast.error(`Unsupported file type: ${file.name}`);
          continue;
        }
        if (file.size > 2 * 1024 * 1024 * 1024) { // 2GB limit
          toast.error(`File too large: ${file.name}`);
          continue;
        }

        const mediaItem = await probeFile(file);
        const handle = handles?.[i] ?? null;

        // Store handle first (cheap, no copy). On Chrome/Edge this enables
        // SSD streaming later via the windowed cache.
        if (mediaItem.type !== 'text') {
          try {
            await storeMediaHandle(mediaItem.id, file, handle ?? undefined);
          } catch {
            // ignore — we still fall back to IDB
          }
          // Keep IDB as a fallback so projects survive browser restarts even
          // when handles become invalid. The windowed cache prevents the full
          // blob from being held in RAM at playback time.
          await saveFileToDB(mediaItem.id, file);
        }

        addMedia(mediaItem);
        successCount++;
        setProgressPercent(Math.round(((i + 1) / files.length) * 100));
      }

      if (successCount > 0) {
        toast.success(`Imported ${successCount} file${successCount > 1 ? 's' : ''}`);
      }
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Failed to import media');
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setProgressPercent(0);
        setCurrentFileName('');
      }, 400);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files: File[] = [];
    const handles: (FileSystemFileHandle | null)[] = [];

    // Try to capture persistent handles from the drop event.
    // Chromium 86+ exposes getAsFileSystemHandle() — when available we keep
    // a disk reference so playback can stream without loading the whole file.
    for (const item of Array.from(e.dataTransfer.items)) {
      if (item.kind !== 'file') continue;
      if ('getAsFileSystemHandle' in item) {
        try {
          const h = await (item as any).getAsFileSystemHandle();
          if (h && h.kind === 'file') {
            const f = await h.getFile();
            files.push(f);
            handles.push(h);
            continue;
          }
        } catch {
          // fall through to plain file
        }
      }
      const f = item.getAsFile();
      if (f) {
        files.push(f);
        handles.push(null);
      }
    }

    if (files.length === 0) return;
    await processFiles(files, handles);
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processFiles(files);
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return {
    isDragging,
    isUploading,
    progressText,
    progressPercent,
    currentFileName,
    fileInputRef,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect
  };
}
