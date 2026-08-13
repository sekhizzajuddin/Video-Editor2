import { TimelineClip } from '../types';
import { createMotionTrack } from './motionTrackingEngine';
import { useEditorStore } from '../store/editorStore';

/**
 * Auto-Reframe Engine
 * Identifies the main subject (e.g. center of the frame) in a landscape 16:9 video
 * and tracks it to keep it centered when reframing to portrait 9:16.
 */
export async function applyAutoReframeToClip(clip: TimelineClip) {
  const store = useEditorStore.getState();
  
  // Define a central region in the video as the main subject to track
  const centerRegion = {
    x: 40, 
    y: 40,
    width: 20,
    height: 20
  };

  // Generate a motion track for the primary subject over the clip duration
  const track = createMotionTrack(
    clip.id, 
    'Auto-Reframe Tracker (Subject)', 
    centerRegion, 
    clip.duration,
    30
  );

  // Add the generated motion track to the clip's track list
  store.updateClip(clip.id, {
    motionTracks: [...(clip.motionTracks || []), track]
  });

  // Update the clip's per-ratio framing for 9:16 to bind it to this auto-reframe track.
  // We do not apply hard X/Y offsets, but instead link the motion track so the 
  // CanvasRenderingEngine can invert the track motion and pan the clip to keep it centered.
  store.updateClipPerRatioFraming(clip.id, '9:16', {
    autoReframeTrackId: track.id,
    x: 0,
    y: 0,
    scale: 1.0 // Slightly zoom in 16:9 into 9:16 to fill vertical if necessary, or just rely on default fit.
  });
}
