// ─────────────────────────────────────────────────────────────────────────────
// [SHARED CORE] Used by BOTH the desktop editor (src/App.tsx → DesktopApp) and
// the mobile editor (src/mobile/App.tsx → MobileApp). There is NO separate mobile
// copy — edit ONCE here. LOGIC / ARCHITECTURE / BUGFIX changes automatically apply
// to both UIs. UI-only changes belong in the individual UI layer instead.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react';
import { X, Video, SlidersHorizontal, Settings2, MonitorPlay, FileOutput, LayoutTemplate } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';

const HELP_SECTIONS = [
  { 
    id: 'media-panel', 
    title: 'Media Panel', 
    icon: Video, 
    img: '/help_media_panel.png', 
    description: 'The Media Panel is your library and asset generation hub.',
    options: [
      { name: 'Import Files', desc: 'Drag and drop or click to import Video, Audio, or Image files from your computer.' },
      { name: 'Record Screen', desc: 'Capture your screen and microphone directly into the editor for tutorials or gameplay.' },
      { name: 'Text to Speech', desc: 'Type text and choose a voice to generate realistic AI voiceovers.' },
      { name: 'Generate Video', desc: 'Use AI to generate stock footage based on a text prompt.' },
      { name: 'Generate Subtitle', desc: 'Automatically transcribe the audio in your video to create captions on a new track.' },
      { name: 'Auto-Beat Detection', desc: 'Analyzes an audio track and places markers on the beats so you can cut video perfectly in sync with music.' },
    ]
  },
  { 
    id: 'timeline', 
    title: 'Timeline', 
    icon: SlidersHorizontal, 
    img: '/help_timeline.png', 
    description: 'The Timeline is where you sequence and edit your media.',
    options: [
      { name: 'Selection Tool (V)', desc: 'The default tool. Click to select clips, drag to move them, and drag edges to trim.' },
      { name: 'Razor Tool (C)', desc: 'Click anywhere on a clip to split it into two independent pieces.' },
      { name: 'Ripple Delete (Backspace)', desc: 'Deletes the selected clip and automatically shifts all subsequent clips to the left to close the gap.' },
      { name: 'Magnet Snap', desc: 'When toggled on, dragging clips will snap them perfectly to the edges of other clips and the playhead.' },
      { name: 'Auto Cut', desc: 'AI analyzes the video and removes silent or boring parts automatically.' },
      { name: 'Tracks & Overlayers', desc: 'You can add multiple video and audio tracks. Place clips on higher tracks to overlay them (e.g., Picture-in-Picture).' },
      { name: 'Zoom Slider', desc: 'Zoom in for precise frame-by-frame edits, or zoom out to see your whole project.' },
    ]
  },
  { 
    id: 'properties', 
    title: 'Properties Panel', 
    icon: Settings2, 
    img: '/help_properties.png', 
    description: 'Adjust the specific settings of whatever clip is currently selected.',
    options: [
      { name: 'Transform Settings', desc: 'Change the Scale, Position (X/Y), and Rotation of a video or image clip.' },
      { name: 'Opacity & Blending', desc: 'Lower opacity for a transparent effect.' },
      { name: 'Transitions', desc: 'Apply fade, wipe, or slide effects to the beginning or end of clips.' },
      { name: 'Animations', desc: 'Add keyframe-like motion presets to make elements move across the screen.' },
      { name: 'Text Styling', desc: 'For text clips, change the font family, color, size, and background.' },
      { name: 'Smart Reframe', desc: 'AI automatically tracks the main subject and reframes horizontal video for vertical (9:16) aspect ratios.' },
      { name: 'Auto Color', desc: 'AI enhances the brightness, contrast, and saturation of your footage with one click.' },
    ]
  },
  { 
    id: 'preview', 
    title: 'Preview Canvas', 
    icon: MonitorPlay, 
    img: '/help_preview.png', 
    description: 'The Preview Canvas shows exactly what your final exported video will look like.',
    options: [
      { name: 'Playback Controls', desc: 'Play, pause, skip forward/backward, and loop the video playback.' },
      { name: 'Safe Zones', desc: 'Overlays a grid showing the UI boundaries of TikTok, Reels, or Shorts so your text doesn\'t get covered.' },
      { name: 'Resolution Toggle', desc: 'Change the aspect ratio of the canvas (16:9, 9:16, 1:1, etc.).' },
      { name: 'Selection & Deselection', desc: 'Clicking the empty background of the canvas deselects all clips.' },
    ]
  },
  { 
    id: 'audio-mixer', 
    title: 'Audio Mixer', 
    icon: LayoutTemplate, 
    img: '/help_audio.png', 
    description: 'The Audio Mixer gives you professional control over your project\'s sound levels.',
    options: [
      { name: 'Track Volume Faders', desc: 'Adjust the volume independently for every audio and video track in the timeline.' },
      { name: 'Master Volume', desc: 'Controls the overall volume output of the entire project.' },
      { name: 'Mute (M)', desc: 'Completely silences a specific track.' },
      { name: 'Solo (S)', desc: 'Mutes all other tracks so you only hear the soloed track.' },
      { name: 'Pan', desc: 'Shifts the audio output to the left or right stereo channel.' },
    ]
  },
  { 
    id: 'export', 
    title: 'Export', 
    icon: FileOutput, 
    img: '/help_export.png', 
    description: 'When finished, use the Export menu to render your final video file.',
    options: [
      { name: 'Format (MP4)', desc: 'The standard video format, widely supported everywhere.' },
      { name: 'Format (WebM)', desc: 'Great for web use and supports transparent backgrounds.' },
      { name: 'Format (GIF)', desc: 'Exports a silent animated image, perfect for memes.' },
      { name: 'Format (MP3)', desc: 'Exports only the audio of your project.' },
      { name: 'Resolution & FPS', desc: 'Choose between 720p, 1080p, or 4K, and 30 or 60 frames per second.' },
      { name: 'Quality Presets', desc: 'High quality increases file size, Low quality reduces it for faster uploads.' },
    ]
  },
  { 
    id: 'toolbar', 
    title: 'Top Toolbar', 
    icon: LayoutTemplate, 
    img: null, 
    description: 'The Top Toolbar contains global project actions.',
    options: [
      { name: 'Undo / Redo', desc: 'Revert your last action or re-apply it (Ctrl+Z / Ctrl+Y).' },
      { name: 'Workspace Layouts', desc: 'Switch between Default, Vertical, and Horizontal panel layouts based on your preference.' },
      { name: 'Teleprompter', desc: 'Opens a scrolling text prompter you can read from while recording your screen or camera.' },
      { name: 'Settings', desc: 'Access global app settings like proxy editing.' },
    ]
  }
];

export const HelpModal: React.FC = () => {
  const { showHelpMenu, activeHelpSection, setShowHelpMenu } = useEditorStore(
    useShallow(s => ({
      showHelpMenu: s.showHelpMenu,
      activeHelpSection: s.activeHelpSection,
      setShowHelpMenu: s.setShowHelpMenu,
    }))
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showHelpMenu) {
        setShowHelpMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHelpMenu, setShowHelpMenu]);

  if (!showHelpMenu) return null;

  const activeId = activeHelpSection && HELP_SECTIONS.some(s => s.id === activeHelpSection) 
    ? activeHelpSection 
    : 'timeline';
  
  const activeContent = HELP_SECTIONS.find(s => s.id === activeId)!;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 lg:p-12 animate-in fade-in duration-200">
      <div className="bg-surface-800 border border-surface-700 rounded-xl shadow-2xl w-full max-w-6xl max-h-full flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between p-4 border-b border-surface-700 bg-surface-800/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <span className="text-amber-500 font-bold text-lg">?</span>
            </div>
            <h2 className="text-xl font-bold text-white">Help & Documentation</h2>
          </div>
          <button
            onClick={() => setShowHelpMenu(false)}
            className="p-2 text-surface-400 hover:text-white hover:bg-surface-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-64 shrink-0 border-r border-surface-700 bg-surface-900/50 overflow-y-auto p-3 flex flex-col gap-1">
            {HELP_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeId === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setShowHelpMenu(true, section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all ${
                    isActive 
                      ? 'bg-amber-500/10 text-amber-500 font-medium' 
                      : 'text-surface-400 hover:bg-surface-800 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-500' : 'text-surface-400'}`} />
                  <span className="text-sm">{section.title}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-surface-800">
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="flex items-center gap-3">
                <activeContent.icon className="w-8 h-8 text-amber-500" />
                <h1 className="text-3xl font-bold text-white">{activeContent.title}</h1>
              </div>
              
              <p className="text-lg text-surface-300 leading-relaxed">
                {activeContent.description}
              </p>

              {activeContent.options && activeContent.options.length > 0 && (
                <div className="mt-8 space-y-4">
                  <h3 className="text-xl font-semibold text-white border-b border-surface-700 pb-2">Options & Features</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeContent.options.map((opt, i) => (
                      <div key={i} className="p-4 bg-surface-900/50 rounded-lg border border-surface-700 hover:border-surface-600 transition-colors">
                        <h4 className="text-amber-500 font-medium mb-1">{opt.name}</h4>
                        <p className="text-sm text-surface-300 leading-relaxed">{opt.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeContent.img && (
                <div className="mt-8 rounded-xl overflow-hidden border border-surface-600 shadow-xl bg-surface-900">
                  <img 
                    src={activeContent.img} 
                    alt={`Help visual for ${activeContent.title}`}
                    className="w-full h-auto object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
