
import React, { useState, useRef, useCallback } from 'react';
import { Search, Grid3X3, List, Upload, Type, Monitor, Square, Sparkles, Loader2, AlertTriangle, X, Music, Film, Play, Waves, Trash2 } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useMediaImport } from '@/hooks/media/useMediaImport';
import type { MediaItem } from '@/types';

export function ProjectTab({
  searchQuery, setSearchQuery, viewMode, setViewMode, filteredMedia,
  importing, fileInputRef, srtInputRef, isRecordingScreen, stopScreenRecord, startScreenRecord,
  setShowAIGeneratorModal, aiVideoIsGenerating, aiVideoProgress, mediaLibrary,
  relinkInputRef, previewItem, setPreviewItem, formatDuration, formatSize,
  handleDragStart, setHoveredItem, getMediaColor, renderMediaThumbnail,
  setConfirmDeleteId, confirmDeleteId, handleDelete, getMediaIcon, handleDetectBeats, detectingBeatId,
  renderWaveformPreview
}: any) {
  return (
    <div className="flex flex-col h-full">


            {/* Search & View Controls */}
            <div className="p-2 border-b border-border">
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <label htmlFor="media-search" className="sr-only">Search media</label>
                <input
                  id="media-search"
                  type="text"
                  placeholder="Search media..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-card border border-border rounded text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {filteredMedia.length} items
                  </span>
                </div>
                <div className="flex bg-card rounded border border-border">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1 rounded transition-colors ${
                      viewMode === 'grid' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Grid3X3 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1 rounded transition-colors ${
                      viewMode === 'list' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <List className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Media List */}
            <div className="flex-1 overflow-y-auto">
              {/* Import Buttons */}
              <div className="p-2 flex gap-1.5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="flex-1 py-2 border-2 border-dashed border-border rounded text-muted-foreground hover:text-foreground hover:border-amber-500 text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                  title="Import Video, Audio, or Image files"
                >
                  {importing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3" />
                  )}
                  {importing ? 'Importing...' : 'Import Media'}
                </button>
                <button
                  onClick={() => srtInputRef.current?.click()}
                  disabled={importing}
                  className="flex-1 py-2 border-2 border-dashed border-border rounded text-muted-foreground hover:text-foreground hover:border-purple-500 text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                  title="Import Subtitles (.srt file)"
                >
                  <Type className="w-3 h-3 text-purple-400" />
                  Import Subtitles
                </button>
              </div>
              <div className="flex px-2 mt-2 gap-2">
                <button
                  onClick={isRecordingScreen ? stopScreenRecord : startScreenRecord}
                  disabled={importing}
                  className={`flex-1 py-2 border-2 ${isRecordingScreen ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-dashed border-border text-muted-foreground hover:text-white hover:border-red-500'} rounded text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-50`}
                  title="Record Screen"
                >
                  {isRecordingScreen ? <Square className="w-3 h-3 text-red-400" /> : <Monitor className="w-3 h-3 text-red-400" />}
                  {isRecordingScreen ? 'Stop' : 'Record'}
                </button>
                <button
                  onClick={() => setShowAIGeneratorModal(true)}
                  disabled={importing}
                  className="relative flex-1 py-2 bg-gradient-to-r from-amber-600/20 to-amber-500/20 hover:from-amber-600/40 hover:to-amber-500/40 border-2 border-dashed border-amber-500/50 hover:border-amber-500 text-amber-500 hover:text-amber-400 rounded text-xs flex items-center justify-center gap-1 transition-all disabled:opacity-50 overflow-hidden"
                  title="AI Generation"
                >
                  {aiVideoIsGenerating && (
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-amber-500/20 transition-all duration-300 ease-out z-0"
                      style={{ width: `${aiVideoProgress}%` }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1">
                    {aiVideoIsGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {aiVideoIsGenerating ? `${Math.round(aiVideoProgress)}%` : 'AI Gen'}
                  </span>
                </button>
              </div>

              {/* Missing files warning banner */}
              {(() => {
                const missing = mediaLibrary.filter(
                  (m: MediaItem) => m.type !== 'text' && m.type !== 'fx' && (m.url === 'PENDING_RESTORE' || !m.url)
                );
                if (missing.length > 0) {
                  return (
                    <div className="mx-2 mb-2 p-3 bg-red-950/40 border border-red-500/30 rounded flex flex-col gap-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-red-200">
                            {missing.length} Missing files in project
                          </p>
                          <p className="text-[10px] text-red-300/80 leading-normal mt-0.5">
                            Some local media files are not linked to this browser session. Please re-link them.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => relinkInputRef.current?.click()}
                        className="w-full py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-medium rounded transition-colors"
                      >
                        Re-link Files
                      </button>
                    </div>
                  );
                }
                return null;
              })()}

              {previewItem && (
                <div className="mx-2 mb-2 p-2 bg-secondary border border-border rounded flex flex-col gap-2 relative">
                  <div className="relative aspect-video bg-black flex items-center justify-center rounded overflow-hidden">
                    {previewItem.type === 'video' && previewItem.url && previewItem.url !== 'PENDING_RESTORE' && (
                      <video
                        key={previewItem.id}
                        src={previewItem.url}
                        controls
                        className="w-full h-full object-contain"
                        autoPlay={false}
                      />
                    )}
                    {previewItem.type === 'audio' && previewItem.url && previewItem.url !== 'PENDING_RESTORE' && (
                      <div className="p-3 w-full flex flex-col items-center justify-center">
                        <Music className="w-8 h-8 text-emerald-400 mb-2" />
                        <audio src={previewItem.url} controls className="w-full h-8" />
                      </div>
                    )}
                    {previewItem.type === 'image' && previewItem.url && previewItem.url !== 'PENDING_RESTORE' && (
                      <img src={previewItem.url} className="w-full h-full object-contain" alt="" />
                    )}
                    <button
                      onClick={() => setPreviewItem(null)}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-black/80 rounded-full text-white/70 hover:text-white transition-colors"
                      title="Close Preview"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="px-1 py-0.5 text-[10px] text-muted-foreground truncate font-medium flex justify-between items-center">
                    <span className="truncate flex-1 pr-2">{previewItem.name}</span>
                    <span className="shrink-0">{formatDuration(previewItem.duration)}</span>
                  </div>
                </div>
              )}

              {filteredMedia.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Film className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-xs font-medium">No media yet</p>
                  <p className="text-[10px] mt-1.5 text-center px-4">
                    Import video, audio, or image files<br />
                    or drag & drop them here
                  </p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 gap-1.5 p-2">
                  {filteredMedia.map((media: MediaItem) => (
                    <div
                      key={media.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, media.id)}
                      onMouseEnter={() => setHoveredItem(media.id)}
                      onMouseLeave={() => setHoveredItem(null)}
                      onClick={() => setPreviewItem(media)}
                      className={`${getMediaColor(media.type)} border rounded overflow-hidden cursor-grab hover:brightness-110 transition-all group relative`}
                    >
                      {/* Thumbnail */}
                      <div className="h-16 relative bg-black/20">
                        {renderMediaThumbnail(media)}

                        {/* Play overlay for video */}
                        {media.type === 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-7 h-7 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm">
                              <Play className="w-3.5 h-3.5 text-foreground ml-0.5" fill="white" />
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
                          <X className="w-2.5 h-2.5 text-foreground" />
                        </button>

                        {/* Type badge */}
                        <div className="absolute bottom-0.5 left-0.5 px-1 py-0.5 bg-black/60 rounded text-[7px] text-white/70 uppercase font-medium">
                          {media.type}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-1.5">
                        <p className="text-[10px] text-foreground truncate">{media.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <p className="text-[9px] text-muted-foreground">{formatDuration(media.duration)}</p>
                          {media.width && media.height && (
                            <p className="text-[9px] text-muted-foreground">· {media.width}×{media.height}</p>
                          )}
                        </div>

                        {/* Audio waveform mini preview */}
                        {media.type === 'audio' && renderWaveformPreview(media)}
                      </div>

                      {/* Delete confirmation */}
                      {confirmDeleteId === media.id && (
                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-1.5 z-20 rounded">
                          <p className="text-[9px] text-foreground">Delete?</p>
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(media.id); }}
                              className="px-2 py-0.5 bg-red-500 hover:bg-red-400 text-white text-[9px] rounded transition-colors"
                            >
                              Delete
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                              className="px-2 py-0.5 bg-accent hover:bg-border text-foreground text-[9px] rounded transition-colors"
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
                  {filteredMedia.map((media: MediaItem) => (
                    <div
                      key={media.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, media.id)}
                      onMouseEnter={() => setHoveredItem(media.id)}
                      onMouseLeave={() => setHoveredItem(null)}
                      onClick={() => setPreviewItem(media)}
                      className="flex items-center gap-2 p-2 hover:bg-accent cursor-grab border-b border-border transition-colors group"
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
                        <p className="text-[11px] text-foreground truncate">{media.name}</p>
                        <p className="text-[9px] text-muted-foreground">
                          {formatDuration(media.duration)} · {formatSize(media.size)}
                          {media.width && media.height ? ` · ${media.width}×${media.height}` : ''}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {media.type === 'video' && <Play className="w-3 h-3 text-muted-foreground" />}
                        {(media.type === 'audio' || media.type === 'video') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDetectBeats(media); }}
                            title="Detect Beats"
                            disabled={detectingBeatId === media.id}
                            className="p-0.5 text-muted-foreground hover:text-yellow-400 rounded transition-colors disabled:opacity-50"
                          >
                            {detectingBeatId === media.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Waves className="w-3 h-3" />
                            }
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(media.id);
                          }}
                          className="p-0.5 text-muted-foreground hover:text-red-400 rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>


                      {/* Delete confirmation overlay for list */}
                      {confirmDeleteId === media.id && (
                        <div className="absolute right-2 flex items-center gap-1 bg-popover border border-border rounded px-2 py-1 shadow-lg z-20">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(media.id); }}
                            className="px-2 py-0.5 bg-red-500 hover:bg-red-400 text-white text-[9px] rounded transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                            className="px-2 py-0.5 bg-accent hover:bg-border text-foreground text-[9px] rounded transition-colors"
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
          
        
    </div>
  );
}
