import { useEditorStore } from '@/store/editorStore';

export interface ChunkMetadata {
  time: number;
  description: string;
}

export interface ChunkAnalysisResult {
  frames: string[]; // Base64 data URLs
  metadata: ChunkMetadata[];
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function captureCanvasChunk(
  startTime: number,
  duration: number,
  fps: number = 5
): Promise<ChunkAnalysisResult> {
  const store = useEditorStore.getState();
  const originalTime = store.currentTime;
  const isPlaying = store.isPlaying;

  if (isPlaying) {
    store.togglePlayback();
  }

  const frames: string[] = [];
  const metadata: ChunkMetadata[] = [];
  const canvas = document.getElementById('preview-canvas') as HTMLCanvasElement;

  if (!canvas) {
    throw new Error('Preview canvas not found.');
  }

  const numFrames = Math.floor(duration * fps);
  const timeStep = 1 / fps;

  for (let i = 0; i < numFrames; i++) {
    const t = startTime + i * timeStep;
    if (t > store.totalDuration) break;

    // Seek
    useEditorStore.setState({ currentTime: t });
    
    // Give React and video elements time to render
    // 50ms is usually enough for a seek and canvas draw
    await wait(50); 

    // Capture frame
    const dataUrl = canvas.toDataURL('image/jpeg', 0.5); // Use lower quality to save memory
    frames.push(dataUrl);

    // Capture metadata at this time
    const activeClips = store.tracks.flatMap(track => 
      track.clips.filter(c => t >= c.startTime && t < c.startTime + c.duration)
    );

    let descParts = [];
    for (const clip of activeClips) {
      if (clip.mediaId) {
        const media = store.mediaLibrary.find(m => m.id === clip.mediaId);
        if (media) descParts.push(`Playing ${media.type}: ${media.name}`);
      } else if (clip.textSettings) {
        descParts.push(`Text displaying: "${clip.textSettings.text || ''}"`);
      }
      
      // Check transitions
      if (clip.transitionOut) {
        const trStart = clip.startTime + clip.duration - (clip.transitionOut.duration || 1);
        if (t >= trStart) {
          descParts.push(`Transition active: ${clip.transitionOut.type}`);
        }
      }
    }

    if (descParts.length > 0) {
      metadata.push({
        time: t,
        description: descParts.join(' | ')
      });
    }
  }

  // Restore state
  useEditorStore.setState({ currentTime: originalTime });

  return { frames, metadata };
}
