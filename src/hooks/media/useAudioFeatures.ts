
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useEditorStore } from '@/store/editorStore';
import { detectBeats } from '@/utils/beatDetection';
import type { MediaItem } from '@/types';

export function useAudioFeatures() {
  const addBeatMarkers = useEditorStore(state => state.addBeatMarkers);
  const [detectingBeatId, setDetectingBeatId] = useState<string | null>(null);
const handleDetectBeats = useCallback(async (media: MediaItem) => {
    if (!media.url || detectingBeatId) return;
    setDetectingBeatId(media.id);
    try {
      const result = await detectBeats(media.url);
      addBeatMarkers(media.id, result.beats);
      toast.warning(`✅ Found ${result.beats.length} beats — ~${result.bpm} BPM (confidence: ${Math.round(result.confidence * 100)}%)\n\nBeat markers added to the timeline ruler.`);
    } catch (err) {
      console.error('Beat detection failed:', err);
      toast.error('Beat detection failed. Make sure the clip has valid audio.');
    } finally {
      setDetectingBeatId(null);
    }
  }, [addBeatMarkers, detectingBeatId]);


  
  return {
    detectingBeatId,
    handleDetectBeats
  };
}
