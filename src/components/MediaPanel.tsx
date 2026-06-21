import {
  Film,
  Music,
  Image,
  Search,
  Grid3X3,
  List,
  Upload,
  Sparkles,
  Waves,
  Folder,
  Sun,
  Droplets,
  Zap,
  Play,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useState, useRef } from 'react';
import type { MediaTab, MediaType } from '@/types';

const TRANSITIONS = [
  { name: 'Fade', color: 'from-amber-500/20 to-transparent', preview: 'Fade in/out between clips' },
  { name: 'Cross Dissolve', color: 'from-purple-500/20 to-transparent', preview: 'Smooth blend transition' },
  { name: 'Wipe Left', color: 'from-blue-500/20 to-transparent', preview: 'Horizontal wipe to left' },
  { name: 'Wipe Right', color: 'from-blue-500/20 to-transparent', preview: 'Horizontal wipe to right' },
  { name: 'Zoom In', color: 'from-cyan-500/20 to-transparent', preview: 'Zoom into next clip' },
  { name: 'Zoom Out', color: 'from-cyan-500/20 to-transparent', preview: 'Zoom out from clip' },
  { name: 'Slide Up', color: 'from-emerald-500/20 to-transparent', preview: 'Slide up transition' },
  { name: 'Slide Down', color: 'from-emerald-500/20 to-transparent', preview: 'Slide down transition' },
];

const EFFECTS = [
  { name: 'Brightness', icon: Sun, color: 'text-amber-400', value: 100 },
  { name: 'Contrast', icon: Droplets, color: 'text-cyan-400', value: 100 },
  { name: 'Saturation', icon: Waves, color: 'text-purple-400', value: 100 },
  { name: 'Blur', icon: Droplets, color: 'text-blue-400', value: 0 },
  { name: 'Sharpen', icon: Zap, color: 'text-yellow-400', value: 0 },
  { name: 'Vignette', icon: Sun, color: 'text-rose-400', value: 0 },
  { name: 'Color Grading', icon: Sparkles, color: 'text-emerald-400', value: 0 },
  { name: 'Chroma Key', icon: Waves, color: 'text-green-400', value: 0 },
];

const AUDIO_PRESETS = [
  { name: 'Ambient 1', duration: '3:24', bpm: 90 },
  { name: 'Epic Music', duration: '2:45', bpm: 120 },
  { name: 'Lo-Fi Beat', duration: '4:12', bpm: 85 },
  { name: 'Nature Sounds', duration: '5:30', bpm: 0 },
  { name: 'Upbeat Track', duration: '3:08', bpm: 140 },
  { name: 'Dramatic Score', duration: '2:55', bpm: 100 },
];

export function MediaPanel() {
  const { mediaLibrary, activeMediaTab, setActiveMediaTab } = useEditorStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tabs: { id: MediaTab; label: string; icon: typeof Film }[] = [
    { id: 'project', label: 'Project', icon: Folder },
    { id: 'transitions', label: 'Transitions', icon: Sparkles },
    { id: 'audio', label: 'Audio', icon: Music },
    { id: 'effects', label: 'Effects', icon: Waves },
  ];

  const filteredMedia = mediaLibrary.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDragStart = (e: React.DragEvent, mediaId: string) => {
    e.dataTransfer.setData('application/procut-media', mediaId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      const type: MediaType = file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
        ? 'audio'
        : 'image';
      const { addMedia } = useEditorStore.getState();
      addMedia({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type,
        duration: type === 'image' ? 5 : 30,
        url,
        size: file.size,
        createdAt: Date.now(),
      });
    });
  };

  const getMediaIcon = (type: MediaType) => {
    switch (type) {
      case 'video': return <Film className="w-5 h-5 text-blue-400" />;
      case 'audio': return <Music className="w-5 h-5 text-emerald-400" />;
      case 'image': return <Image className="w-5 h-5 text-amber-400" />;
    }
  };

  const getMediaColor = (type: MediaType) => {
    switch (type) {
      case 'video': return 'bg-blue-500/10 border-blue-500/20';
      case 'audio': return 'bg-emerald-500/10 border-emerald-500/20';
      case 'image': return 'bg-amber-500/10 border-amber-500/20';
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="h-full flex flex-col bg-[#252525] border-r border-[#3e3e3e]">
      {/* Tabs */}
      <div className="flex border-b border-[#3e3e3e]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeMediaTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveMediaTab(tab.id)}
              className={`flex-1 py-2.5 text-[10px] font-medium uppercase tracking-wider flex flex-col items-center gap-1 transition-colors ${
                isActive
                  ? 'text-white border-b-2 border-amber-500 bg-[#2d2d2d]'
                  : 'text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeMediaTab === 'project' && (
          <>
            {/* Search & View Controls */}
            <div className="p-2 border-b border-[#3e3e3e]">
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a0a0a0]" />
                <input
                  type="text"
                  placeholder="Search media..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#1e1e1e] border border-[#3e3e3e] rounded text-xs text-white placeholder-[#a0a0a0] focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#a0a0a0]">
                  {filteredMedia.length} items
                </span>
                <div className="flex bg-[#1e1e1e] rounded border border-[#3e3e3e]">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1 rounded transition-colors ${
                      viewMode === 'grid' ? 'bg-[#3e3e3e] text-white' : 'text-[#a0a0a0] hover:text-white'
                    }`}
                  >
                    <Grid3X3 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1 rounded transition-colors ${
                      viewMode === 'list' ? 'bg-[#3e3e3e] text-white' : 'text-[#a0a0a0] hover:text-white'
                    }`}
                  >
                    <List className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Media List */}
            <div className="flex-1 overflow-y-auto">
              {/* Import Button */}
              <div className="p-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 border-2 border-dashed border-[#3e3e3e] rounded text-[#a0a0a0] hover:text-white hover:border-amber-500 text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" /> Import Media
                </button>
              </div>

              {filteredMedia.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-[#a0a0a0]">
                  <Film className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs">No media yet</p>
                  <p className="text-[10px] mt-1">Import files to get started</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 gap-1.5 p-2">
                  {filteredMedia.map((media) => (
                    <div
                      key={media.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, media.id)}
                      onMouseEnter={() => setHoveredItem(media.id)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`${getMediaColor(media.type)} border rounded p-2 cursor-grab hover:brightness-110 transition-all group relative`}
                    >
                      {/* Media preview thumbnail */}
                      <div className="flex items-center justify-center h-12 mb-1.5 relative">
                        {getMediaIcon(media.type)}
                        {media.type === 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-6 h-6 bg-black/50 rounded-full flex items-center justify-center">
                              <Play className="w-3 h-3 text-white ml-0.5" fill="white" />
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-white truncate">{media.name}</p>
                      <p className="text-[9px] text-[#a0a0a0]">{formatDuration(media.duration)}</p>

                      {/* Quick preview tooltip */}
                      {hoveredItem === media.id && media.type === 'video' && (
                        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded p-1.5 text-[9px] text-[#a0a0a0] z-50 shadow-lg">
                          <div className="flex items-center gap-1 mb-1">
                            <Film className="w-2.5 h-2.5 text-blue-400" />
                            <span>Video Preview</span>
                          </div>
                          <div className="h-1 bg-[#3e3e3e] rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500/50 w-1/3 rounded-full" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col">
                  {filteredMedia.map((media) => (
                    <div
                      key={media.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, media.id)}
                      onMouseEnter={() => setHoveredItem(media.id)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className="flex items-center gap-2 p-2 hover:bg-[#3e3e3e] cursor-grab border-b border-[#3e3e3e] transition-colors group"
                    >
                      {getMediaIcon(media.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-white truncate">{media.name}</p>
                        <p className="text-[9px] text-[#a0a0a0]">
                          {formatDuration(media.duration)} · {formatSize(media.size)}
                        </p>
                      </div>
                      {media.type === 'video' && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-3 h-3 text-[#a0a0a0]" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeMediaTab === 'transitions' && (
          <div className="flex-1 overflow-y-auto p-2">
            <p className="text-xs text-[#a0a0a0] mb-3">Drag transitions between clips on timeline</p>
            {TRANSITIONS.map((transition) => (
              <div
                key={transition.name}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/procut-transition', transition.name);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onMouseEnter={() => setHoveredItem(transition.name)}
                onMouseLeave={() => setHoveredItem(null)}
                className="flex items-center gap-2 p-2 hover:bg-[#3e3e3e] rounded cursor-grab border-b border-[#3e3e3e] transition-colors group relative"
              >
                {/* Transition preview thumbnail */}
                <div className={`w-8 h-8 rounded bg-gradient-to-r ${transition.color} flex items-center justify-center border border-[#3e3e3e]`}>
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-white block">{transition.name}</span>
                  <span className="text-[9px] text-[#a0a0a0]">{transition.preview}</span>
                </div>

                {/* Preview tooltip */}
                {hoveredItem === transition.name && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded p-2 text-[9px] text-[#a0a0a0] z-50 shadow-lg">
                    <div className="flex items-center gap-1 mb-1">
                      <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                      <span>Transition Preview</span>
                    </div>
                    <div className="h-1 bg-[#3e3e3e] rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500/50 w-1/2 rounded-full" />
                    </div>
                    <p className="mt-1 text-[8px]">{transition.preview}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeMediaTab === 'audio' && (
          <div className="flex-1 overflow-y-auto p-2">
            <p className="text-xs text-[#a0a0a0] mb-3">Audio Library</p>
            {AUDIO_PRESETS.map((audio) => (
              <div
                key={audio.name}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/procut-audio', audio.name);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onMouseEnter={() => setHoveredItem(audio.name)}
                onMouseLeave={() => setHoveredItem(null)}
                className="flex items-center gap-2 p-2 hover:bg-[#3e3e3e] rounded cursor-grab border-b border-[#3e3e3e] transition-colors group"
              >
                <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Music className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-white truncate block">{audio.name}</span>
                  <span className="text-[9px] text-[#a0a0a0]">
                    {audio.duration}{audio.bpm > 0 ? ` · ${audio.bpm} BPM` : ''}
                  </span>
                </div>

                {/* Audio waveform preview */}
                {hoveredItem === audio.name && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded p-2 text-[9px] text-[#a0a0a0] z-50 shadow-lg">
                    <div className="flex items-center gap-1 mb-1">
                      <Music className="w-2.5 h-2.5 text-emerald-400" />
                      <span>Audio Preview</span>
                    </div>
                    <div className="flex items-end gap-px h-6">
                      {Array.from({ length: 20 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-emerald-500/40 rounded-full"
                          style={{
                            height: `${20 + Math.sin(i * 0.5) * 15 + Math.random() * 25}%`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeMediaTab === 'effects' && (
          <div className="flex-1 overflow-y-auto p-2">
            <p className="text-xs text-[#a0a0a0] mb-3">Video Effects</p>
            {EFFECTS.map((effect) => {
              const Icon = effect.icon;
              return (
                <div
                  key={effect.name}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/procut-effect', effect.name);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onMouseEnter={() => setHoveredItem(effect.name)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="flex items-center gap-2 p-2 hover:bg-[#3e3e3e] rounded cursor-grab border-b border-[#3e3e3e] transition-colors group relative"
                >
                  <div className={`w-8 h-8 rounded bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${effect.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-white block">{effect.name}</span>
                    <span className="text-[9px] text-[#a0a0a0]">
                      {effect.value === 0 ? 'Click to apply' : `Default: ${effect.value}%`}
                    </span>
                  </div>

                  {/* Effect preview tooltip */}
                  {hoveredItem === effect.name && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#1e1e1e] border border-[#3e3e3e] rounded p-2 text-[9px] text-[#a0a0a0] z-50 shadow-lg">
                      <div className="flex items-center gap-1 mb-1">
                        <Icon className={`w-2.5 h-2.5 ${effect.color}`} />
                        <span>Effect Preview</span>
                      </div>
                      <div className="h-1 bg-[#3e3e3e] rounded-full overflow-hidden">
                        <div className={`h-full ${effect.color.replace('text-', 'bg-')}/50 rounded-full`}
                          style={{ width: `${effect.value}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*"
        onChange={handleImport}
        className="hidden"
      />
    </div>
  );
}
