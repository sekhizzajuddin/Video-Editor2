const fs = require('fs');
let code = fs.readFileSync('src/mobile/components/MobilePropertiesSheet.tsx', 'utf8');

const regex = /const mediaType = useMemo\(\(\) => \{[\s\S]*?\]\n  \};\n/m;
const fix = \const mediaType = useMemo(() => {
    if (!clip) return null;
    return mediaLibrary.find((m) => m.id === clip.mediaId)?.type ?? null;
  }, [clip, mediaLibrary]);

  const isText = !!clip?.textSettings;
  const isAudio = mediaType === 'audio' || !!clip?.audioSettings;
  const category = initialTab || (isText ? 'text' : isAudio ? 'audio' : 'ai');
  const [subTab, setSubTab] = useState<string>('');

  const subTabsMap: Record<string, { id: string; label: string }[]> = {
    style: [
      { id: 'scale', label: 'Scale' },
      { id: 'position', label: 'Position' },
      { id: 'rotation', label: 'Rotation' },
      { id: 'opacity', label: 'Opacity' },
      { id: 'blend', label: 'Blend' },
      { id: 'reframe', label: 'Smart Reframe' },
    ],
    color: [
      { id: 'temp', label: 'Temp' },
      { id: 'exposure', label: 'Exposure' },
      { id: 'contrast', label: 'Contrast' },
      { id: 'saturation', label: 'Saturation' },
      { id: 'blur', label: 'Blur' },
      { id: 'vignette', label: 'Vignette' },
    ],
    audio: [
      { id: 'volume', label: 'Volume' },
      { id: 'ducking', label: 'Ducking' },
      { id: 'fade', label: 'Fade' },
      { id: 'pitch', label: 'Pitch' },
      { id: 'options', label: 'Options' },
    ],
    speed: [
      { id: 'speed', label: 'Speed' },
      { id: 'presets', label: 'Presets' },
      { id: 'ramping', label: 'Speed Ramp' },
    ],
    mask: [
      { id: 'mask', label: 'Mask' },
      { id: 'feather', label: 'Feather' },
      { id: 'chroma', label: 'Chroma Key' },
    ],
    text: [
      { id: 'text', label: 'Text' },
      { id: 'font', label: 'Font Size' },
      { id: 'color', label: 'Color' },
    ],
    ai: [
      { id: 'kinetic', label: 'Kinetic' },
      { id: 'beatsync', label: 'Beat Sync' },
      { id: 'sfx', label: 'SFX' },
      { id: 'eraser', label: 'Magic Eraser' },
      { id: 'object_removal', label: 'Object Removal' },
    ],
  };\;

code = code.replace(regex, fix);
fs.writeFileSync('src/mobile/components/MobilePropertiesSheet.tsx', code);
