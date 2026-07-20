
import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { probeFile } from '@/utils/mediaProbe';
import { saveFileToDB } from '@/utils/projectPersistence';
import { MediaItem } from '@/types';
import { useEditorStore } from '@/store/editorStore';

export function useMediaImport() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const addMedia = useEditorStore(state => state.addMedia);

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setIsUploading(true);
    let successCount = 0;
    
    try {
      for (const file of files) {
        if (!file.type.startsWith('video/') && !file.type.startsWith('audio/') && !file.type.startsWith('image/')) {
          toast.error(`Unsupported file type: ${file.name}`);
          continue;
        }
        if (file.size > 2 * 1024 * 1024 * 1024) { // 2GB limit
          toast.error(`File too large: ${file.name}`);
          continue;
        }

        const mediaItem = await probeFile(file);
        
        // Save to IndexedDB if it's not a text type
        if (mediaItem.type !== 'text') {
          await saveFileToDB(mediaItem.id, file);
        }
        
        addMedia(mediaItem);
        successCount++;
      }
      
      if (successCount > 0) {
        toast.success(`Imported ${successCount} file${successCount > 1 ? 's' : ''}`);
      }
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Failed to import media');
    } finally {
      setIsUploading(false);
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

    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
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
    fileInputRef,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect
  };
}
