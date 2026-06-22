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
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useState, useRef, useCallback } from 'react';
import type { MediaTab, MediaType, MediaItem } from '@/types';
import { probeFile } from '@/utils/mediaProbe';

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

export function MediaPanel() {
  const { mediaLibrary, activeMediaTab, setActiveMediaTab, addMedia, removeMedia } = useEditorStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tabs: { id: MediaTab; label: string; icon: typeof Film }[] = [
    { id: 'project', label: 'Project', icon: Folder },
    { id: 'transitions', label: 'Transitions', icon: Sparkles },
    { id: 'effects', label: 'Effects', icon: Waves },
  ];

  const filteredMedia = mediaLibrary.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDragStart = (e: React.DragEvent, mediaId: string) => {
    e.dataTransfer.setData('application/procut-media', mediaId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Real import with probing
  const importFiles = useCallback(async (files: FileList | File[]) => {
    setImporting(true);
    const fileArray = Array.from(files);

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setImportProgress(`Importing ${file.name} (${i + 1}/${fileArray.length})...`);

      try {
        const mediaItem = await probeFile(file);
        addMedia(mediaItem);
      } catch (err) {
        console.error(`Failed to import ${file.name}:`, err);
      }
    }

    setImporting(false);
    setImportProgress('');
  }, [addMedia]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    importFiles(files);
    // Reset input so the same file can be re-imported
    e.target.value = '';
  }, [importFiles]);

  // Drag-and-drop zone handlers
  const handleZoneDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only accept file drops, not media panel drags
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleZoneDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleZoneDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      importFiles(files);
    }
  }, [importFiles]);

  const handleDelete = (id: string) => {
    removeMedia(id);
    setConfirmDeleteId(null);
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
    if (!isFinite(s) || s < 0) return '0:00';
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

  const renderMediaThumbnail = (media: MediaItem) => {
    if (media.thumbnail) {
      return (
        <img
          src={media.thumbnail}
          alt={media.name}
          className="w-full h-full object-cover rounded-sm"
          draggable={false}
        />
      );
    }
    return (
      <div className="flex items-center justify-center h-full">
        {getMediaIcon(media.type)}
      </div>
    );
  };

  const renderWaveformPreview = (media: MediaItem) => {
    if (!media.waveformPeaks || media.waveformPeaks.length === 0) return null;
    const peaks = media.waveformPeaks;
    // Show ~30 bars for the mini preview
    const step = Math.max(1, Math.floor(peaks.length / 30));
    const displayPeaks: number[] = [];
    for (let i = 0; i < peaks.length; i += step) {
      displayPeaks.push(peaks[i]);
    }

    return (
      <div className="flex items-end gap-px h-6 mt-1">
        {displayPeaks.map((peak, i) => (
          <div
            key={i}
            className="flex-1 bg-emerald-400/50 rounded-sm"
            style={{
              height: `${Math.max(8, peak * 100)}%`,
              minWidth: '1px',
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div
      className="h-full flex flex-col bg-[#252525] border-r border-[#3e3e3e]"
      onDragOver={handleZoneDragOver}
      onDragLeave={handleZoneDragLeave}
      onDrop={handleZoneDrop}
    >
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
      <div className="flex-1 overflow-hidden flex flex-col relative">
        {/* Drag-drop overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-amber-500/10 border-2 border-dashed border-amber-500 flex items-center justify-center rounded">
            <div className="text-center">
              <Upload className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-sm text-amber-300 font-medium">Drop files to import</p>
              <p className="text-xs text-amber-400/60 mt-1">Video, Audio, or Image files</p>
            </div>
          </div>
        )}

        {/* Import progress */}
        {importing && (
          <div className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span className="text-[10px] text-amber-300 truncate">{importProgress}</span>
          </div>
        )}

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
                  disabled={importing}
                  className="w-full py-2.5 border-2 border-dashed border-[#3e3e3e] rounded text-[#a0a0a0] hover:text-white hover:border-amber-500 text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {importing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  {importing ? 'Importing...' : 'Import Media'}
                </button>
              </div>

              {filteredMedia.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[#a0a0a0]">
                  <Film className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-xs font-medium">No media yet</p>
                  <p className="text-[10px] mt-1.5 text-center px-4">
                    Import video, audio, or image files<br />
                    or drag & drop them here
                  </p>
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
                      className={`${getMediaColor(media.type)} border rounded overflow-hidden cursor-grab hover:brightness-110 transition-all group relative`}
                    >
                      {/* Thumbnail */}
                      <div className="h-16 relative bg-black/20">
                        {renderMediaThumbnail(media)}

                        {/* Play overlay for video */}
                        {media.type === 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-7 h-7 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm">
                              <Play className="w-3.5 h-3.5 text-white ml-0.5" fill="white" />
                            </div>
                          </div>
                        )}

                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(media.id);
                          }}
                          className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all"
                        >
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>

                        {/* Type badge */}
                        <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 bg-black/60 rounded text-[7px] text-white/70 uppercase font-medium">
                          {media.type}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-1.5">
                        <p className="text-[10px] text-white truncate">{media.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <p className="text-[9px] text-[#a0a0a0]">{formatDuration(media.duration)}</p>
                          {media.width && media.height && (
                            <p className="text-[9px] text-[#a0a0a0]">· {media.width}×{media.height}</p>
                          )}
                        </div>

                        {/* Audio waveform mini preview */}
                        {media.type === 'audio' && renderWaveformPreview(media)}
                      </div>

                      {/* Delete confirmation */}
                      {confirmDeleteId === media.id && (
                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-1.5 z-20 rounded">
                          <p className="text-[9px] text-white">Delete?</p>
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(media.id); }}
                              className="px-2 py-0.5 bg-red-500 hover:bg-red-400 text-white text-[9px] rounded transition-colors"
                            >
                              Delete
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                              className="px-2 py-0.5 bg-[#3e3e3e] hover:bg-[#5e5e5e] text-white text-[9px] rounded transition-colors"
                            >
                              Cancel
                            </button>
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
                      {/* Thumbnail in list view */}
                      <div className="w-10 h-7 rounded overflow-hidden bg-black/30 shrink-0 flex items-center justify-center">
                        {media.thumbnail ? (
                          <img src={media.thumbnail} alt="" className="w-full h-full object-cover" draggable={false} />
                        ) : (
                          getMediaIcon(media.type)
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-white truncate">{media.name}</p>
                        <p className="text-[9px] text-[#a0a0a0]">
                          {formatDuration(media.duration)} · {formatSize(media.size)}
                          {media.width && media.height ? ` · ${media.width}×${media.height}` : ''}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {media.type === 'video' && <Play className="w-3 h-3 text-[#a0a0a0]" />}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(media.id);
                          }}
                          className="p-0.5 text-[#a0a0a0] hover:text-red-400 rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Delete confirmation overlay for list */}
                      {confirmDeleteId === media.id && (
                        <div className="absolute right-2 flex items-center gap-1 bg-[#2d2d2d] border border-[#3e3e3e] rounded px-2 py-1 shadow-lg z-20">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(media.id); }}
                            className="px-2 py-0.5 bg-red-500 hover:bg-red-400 text-white text-[9px] rounded transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                            className="px-2 py-0.5 bg-[#3e3e3e] hover:bg-[#5e5e5e] text-white text-[9px] rounded transition-colors"
                          >
                            Cancel
                          </button>
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
                <div className={`w-8 h-8 rounded bg-gradient-to-r ${transition.color} flex items-center justify-center border border-[#3e3e3e]`}>
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-white block">{transition.name}</span>
                  <span className="text-[9px] text-[#a0a0a0]">{transition.preview}</span>
                </div>
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
                  <div className="w-8 h-8 rounded bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Icon className={`w-4 h-4 ${effect.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-white block">{effect.name}</span>
                    <span className="text-[9px] text-[#a0a0a0]">
                      {effect.value === 0 ? 'Click to apply' : `Default: ${effect.value}%`}
                    </span>
                  </div>
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
