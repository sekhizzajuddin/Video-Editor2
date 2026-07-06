const uuidv4 = () => crypto.randomUUID();
import { TimelineClip } from '@/types';
import { useEditorStore } from '@/store/editorStore';

const dummyPhrases = [
  "Welcome to the video.",
  "Today we're going to build something amazing.",
  "Let's dive right into the code.",
  "As you can see, the UI updates instantly.",
  "Don't forget to like and subscribe!",
  "Thanks for watching, see you next time."
];

export async function generateAutoCaptions(
  onProgress: (p: number) => void
): Promise<void> {
  const store = useEditorStore.getState();
  const totalDuration = store.totalDuration || 10;
  
  // Simulate network / processing delay
  for (let i = 0; i <= 100; i += 10) {
    onProgress(i);
    await new Promise(r => setTimeout(r, 100));
  }

  // Create text clips
  let currentTime = 0;
  let phraseIndex = 0;
  
  // Find text track, or use top video track
  let targetTrack = store.tracks.find(t => t.type === 'text' && !t.hidden);
  if (!targetTrack) {
    targetTrack = store.tracks.find(t => t.type === 'video' && !t.hidden);
  }
  
  if (!targetTrack) return;

  const newClips: TimelineClip[] = [];

  while (currentTime < totalDuration && phraseIndex < dummyPhrases.length) {
    const duration = 2; // 2 seconds per caption
    if (currentTime + duration > totalDuration) break;

    const clip: TimelineClip = {
      id: uuidv4(),
      mediaId: 'generator:text:auto', // custom id for text generator
      trackId: targetTrack.id,
      startTime: currentTime,
      duration: duration,
      trimStart: 0,
      trimEnd: duration,
      opacity: 1,
      transform: {
        x: 0,
        y: 150, // lower third centered (400 is way below coordinate center which is -H/2 to H/2)
        scale: 100,
        rotation: 0
      },
      speed: 1,
      effects: [],
      textSettings: {
        text: dummyPhrases[phraseIndex],
        fontSize: 32,
        fontFamily: 'Inter',
        color: '#ffffff',
        backgroundColor: '#00000088',
        bold: true,
        italic: false,
        underline: false,
        shadow: false,
        threeD: false,
        textAlign: 'center'
      }
    };
    newClips.push(clip);

    currentTime += duration + 0.5; // 0.5s gap
    phraseIndex++;
  }

  // We need to add these clips to the track
  const newTracks = store.tracks.map(t => {
    if (t.id === targetTrack!.id) {
      return {
        ...t,
        clips: [...t.clips, ...newClips]
      };
    }
    return t;
  });

  useEditorStore.setState({ tracks: newTracks });
}
