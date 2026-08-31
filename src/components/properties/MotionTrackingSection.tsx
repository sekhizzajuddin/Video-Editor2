/**
 * MotionTrackingSection.tsx — Motion Tracking Property Inspector Controls.
 *
 * Allows users to initiate subject motion tracking on video clips and attach
 * text elements, stickers, or PIP overlays to locked motion trajectories.
 */

import React from 'react';
import type { TimelineClip, MotionTrackingData, MotionTrackAttachment } from '@/types';
import { useEditorStore } from '@/store/editorStore';
import { createMotionTrack } from '@/utils/motionTrackingEngine';
import { Target, Link, Unlink, Activity, CheckCircle2 } from 'lucide-react';

interface MotionTrackingSectionProps {
  selectedClip: TimelineClip;
}

export function MotionTrackingSection({ selectedClip }: MotionTrackingSectionProps) {
  const { tracks, updateClip, saveSnapshot, mediaLibrary } = useEditorStore();

  const mediaItem = mediaLibrary.find((m: any) => m.id === selectedClip.mediaId);

  // Find all available motion tracks across video clips
  const allVideoClips = tracks.flatMap((t) => t.clips || []).filter((c) => c.motionTracks && c.motionTracks.length > 0);
  const availableMotionTracks = allVideoClips.flatMap((c) => c.motionTracks || []);

  const currentAttachment: MotionTrackAttachment | undefined = selectedClip.motionAttachment;

  const handleCreateTrack = () => {
    const newTrack = createMotionTrack(
      selectedClip.id,
      `Track ${ (selectedClip.motionTracks?.length || 0) + 1 }`,
      { x: 40, y: 40, width: 20, height: 20 },
      selectedClip.duration
    );

    const existingTracks = selectedClip.motionTracks || [];
    updateClip(selectedClip.id, {
      motionTracks: [...existingTracks, newTrack],
    });
    saveSnapshot('Add Motion Track');
  };

  const handleAttachTrack = (trackId: string) => {
    if (!trackId) {
      updateClip(selectedClip.id, { motionAttachment: undefined });
    } else {
      updateClip(selectedClip.id, {
        motionAttachment: {
          trackId,
          applyPosition: true,
          applyScale: true,
          applyRotation: true,
          offsetX: 0,
          offsetY: 0,
        },
      });
    }
    saveSnapshot('Attach Motion Track');
  };

  const handleToggleAttachmentOption = (key: 'applyPosition' | 'applyScale' | 'applyRotation') => {
    if (!currentAttachment) return;
    updateClip(selectedClip.id, {
      motionAttachment: {
        ...currentAttachment,
        [key]: !currentAttachment[key],
      },
    });
  };

  const isVideo = !selectedClip.textSettings && !selectedClip.isAdjustmentLayer;

  return (
    <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3.5 text-xs text-zinc-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-emerald-400" />
          <span className="font-semibold text-foreground">Motion Tracking</span>
        </div>
        {isVideo && (
          <button
            onClick={handleCreateTrack}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white shadow hover:bg-emerald-500 transition-colors"
          >
            <Activity className="h-3.5 w-3.5" />
            Track Subject 🎯
          </button>
        )}
      </div>

      {/* Video Clips: List of generated motion tracks */}
      {isVideo && selectedClip.motionTracks && selectedClip.motionTracks.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-zinc-800">
          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Generated Motion Trajectories</label>
          <div className="space-y-1">
            {selectedClip.motionTracks.map((mt) => (
              <div key={mt.id} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5">
                <span className="font-medium text-zinc-200">{mt.name}</span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  {mt.keyframes.length} Keyframes
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Text / Attachment Clips: Select motion track target */}
      <div className="space-y-2 pt-1 border-t border-zinc-800">
        <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Attach to Motion Track</label>
        <select
          value={currentAttachment?.trackId || ''}
          onChange={(e) => handleAttachTrack(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
        >
          <option value="">(None — Static Transform)</option>
          {availableMotionTracks.map((mt) => (
            <option key={mt.id} value={mt.id}>
              🎯 {mt.name} ({mt.keyframes.length} frames)
            </option>
          ))}
        </select>

        {currentAttachment && (
          <div className="grid grid-cols-3 gap-2 pt-2">
            <button
              onClick={() => handleToggleAttachmentOption('applyPosition')}
              className={`py-1.5 px-2 rounded border text-[10px] font-medium transition-colors ${
                currentAttachment.applyPosition
                  ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              Position
            </button>
            <button
              onClick={() => handleToggleAttachmentOption('applyScale')}
              className={`py-1.5 px-2 rounded border text-[10px] font-medium transition-colors ${
                currentAttachment.applyScale
                  ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              Scale
            </button>
            <button
              onClick={() => handleToggleAttachmentOption('applyRotation')}
              className={`py-1.5 px-2 rounded border text-[10px] font-medium transition-colors ${
                currentAttachment.applyRotation
                  ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              Rotation
            </button>
          </div>
        )}
      </div>

      {mediaItem?.type === 'video' && (
        <div className="pt-2 mt-4 border-t border-border">
          <h4 className="text-xs font-semibold text-zinc-300 mb-2 flex items-center">
            <span className="mr-1.5">📱</span> Auto-Reframe (9:16)
          </h4>
          <p className="text-[10px] text-zinc-500 mb-3 leading-relaxed">
            Automatically pan to keep the subject centered when exporting or switching to vertical formats.
          </p>
          <button
            onClick={async () => {
              const { applyAutoReframeToClip } = await import('@/utils/autoReframeEngine');
              applyAutoReframeToClip(selectedClip);
            }}
            className="w-full py-2 bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/40 hover:to-purple-600/40 border border-blue-500/30 text-blue-300 rounded text-[11px] font-medium transition-all flex items-center justify-center group"
          >
            <span className="mr-1.5 group-hover:animate-pulse">✨</span> Apply Auto-Reframe
          </button>
        </div>
      )}
    </div>
  );
}
