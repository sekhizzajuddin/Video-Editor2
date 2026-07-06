import React, { useMemo, useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { Scissors, FileText, Search, Plus } from 'lucide-react';
import { TimelineClip } from '@/types';

export function TranscriptPanel() {
  const { tracks, currentTime, seek } = useEditorStore();
  const [searchQuery, setSearchQuery] = useState('');

  // Collect all text clips across all tracks to form the transcript
  const transcriptClips = useMemo(() => {
    const clips: { clip: TimelineClip, trackId: string }[] = [];
    tracks.forEach(track => {
      if (track.hidden) return;
      track.clips.forEach(clip => {
        if (clip.textSettings && clip.textSettings.text) {
          clips.push({ clip, trackId: track.id });
        }
      });
    });
    // Sort chronologically
    return clips.sort((a, b) => a.clip.startTime - b.clip.startTime);
  }, [tracks]);

  const filteredClips = useMemo(() => {
    if (!searchQuery) return transcriptClips;
    const lowerQ = searchQuery.toLowerCase();
    return transcriptClips.filter(c => c.clip.textSettings?.text.toLowerCase().includes(lowerQ));
  }, [transcriptClips, searchQuery]);

  const handleSeek = (time: number) => {
    seek(time);
  };

  const handleRippleDelete = (clipInfo: { clip: TimelineClip, trackId: string }) => {
    // Advanced Ripple Delete:
    // This deletes the selected text clip AND removes that exact time segment from ALL tracks,
    // shifting everything else back.
    const start = clipInfo.clip.startTime;
    const end = clipInfo.clip.startTime + clipInfo.clip.duration;
    const durationToCut = end - start;

    const newTracks = tracks.map(track => {
      // 1. Remove clips that are entirely inside the cut region
      let newClips = track.clips.filter(c => {
        const cEnd = c.startTime + c.duration;
        return !(c.startTime >= start && cEnd <= end);
      });

      newClips = newClips.map(c => {
        const cEnd = c.startTime + c.duration;
        
        // 2. Shift clips that are completely AFTER the cut region
        if (c.startTime >= end) {
          return { ...c, startTime: c.startTime - durationToCut };
        }
        
        // 3. Trim clips that overlap the START of the cut region
        if (c.startTime < start && cEnd > start && cEnd <= end) {
          const newDur = start - c.startTime;
          return { ...c, duration: newDur, trimEnd: c.trimStart + newDur * c.speed };
        }
        
        // 4. Trim clips that overlap the END of the cut region
        if (c.startTime >= start && c.startTime < end && cEnd > end) {
          const newDur = cEnd - end;
          const shiftAmount = end - c.startTime;
          return { 
            ...c, 
            startTime: start, // shifted back
            duration: newDur,
            trimStart: c.trimStart + shiftAmount * c.speed
          };
        }
        
        // 5. Split clips that encompass the ENTIRE cut region
        if (c.startTime < start && cEnd > end) {
          // This requires splitting the clip into two!
          const leftClip = { 
            ...c, 
            duration: start - c.startTime 
          };
          
          const rightClip = {
            ...c,
            id: c.id + '_split_' + Math.random().toString(36).substr(2, 5),
            startTime: start,
            duration: cEnd - end,
            trimStart: c.trimStart + (end - c.startTime) * c.speed
          };
          
          return [leftClip, rightClip];
        }

        return c;
      }).flat();

      return { ...track, clips: newClips };
    });

    useEditorStore.setState({ tracks: newTracks });
    useEditorStore.getState().saveSnapshot('Ripple Delete (Transcript)');
    if (currentTime > start) {
       seek(Math.max(0, start));
    }
  };

  if (transcriptClips.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#1e1e1e] flex items-center justify-center">
          <FileText className="w-8 h-8 text-[#555]" />
        </div>
        <p className="text-[#a0a0a0] text-sm">No text or captions found.</p>
        <p className="text-[#666] text-xs">Use the Auto-Captions feature in the top toolbar to generate a transcript.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111]">
      <div className="p-3 border-b border-[#3e3e3e]">
        <div className="relative">
          <Search className="w-4 h-4 text-[#a0a0a0] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search transcript..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#1e1e1e] text-white text-xs rounded pl-9 pr-3 py-2 border border-[#3e3e3e] focus:border-amber-500 focus:outline-none transition-colors"
          />
        </div>
        <p className="text-[10px] text-[#888] mt-2 leading-tight">
          Editing the text below will automatically cut the video.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredClips.map((info, i) => {
          const isActive = currentTime >= info.clip.startTime && currentTime <= (info.clip.startTime + info.clip.duration);
          
          return (
            <div 
              key={info.clip.id}
              className={`group relative p-3 rounded-lg border transition-all cursor-pointer ${
                isActive ? 'bg-amber-500/10 border-amber-500' : 'bg-[#1e1e1e] border-[#3e3e3e] hover:border-[#555]'
              }`}
              onClick={() => handleSeek(info.clip.startTime)}
            >
              <div className="flex items-start justify-between gap-3">
                <p className={`text-sm leading-relaxed flex-1 ${isActive ? 'text-amber-100 font-medium' : 'text-[#d0d0d0]'}`}>
                  {info.clip.textSettings?.text}
                </p>
                
                {/* Actions that appear on hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRippleDelete(info);
                    }}
                    className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded transition-colors"
                    title="Ripple Delete (Cuts video and audio)"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] font-mono text-[#666]">
                  {formatSimpleTime(info.clip.startTime)} - {formatSimpleTime(info.clip.startTime + info.clip.duration)}
                </span>
                {isActive && (
                  <span className="text-[9px] uppercase tracking-wider text-amber-500 font-semibold bg-amber-500/20 px-1.5 py-0.5 rounded">
                    Playing
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatSimpleTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
}
