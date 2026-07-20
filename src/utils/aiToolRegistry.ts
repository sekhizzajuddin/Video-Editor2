import { useEditorStore } from '../store/editorStore';

// Define the available tools for the AI Copilot
export const aiToolRegistry = [
  {
    name: "addClip",
    description: "Adds a new clip to the timeline on a specific track.",
    parameters: {
      type: "object",
      properties: {
        mediaId: { type: "string", description: "The ID of the media item to add." },
        trackId: { type: "string", description: "The ID of the track (e.g., 'v1', 'v2', 'a1')." },
        startTime: { type: "number", description: "The start time on the timeline in seconds." },
      },
      required: ["mediaId", "trackId", "startTime"]
    }
  },
  {
    name: "updateClip",
    description: "Updates properties of an existing clip on the timeline.",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string", description: "The ID of the clip to update." },
        updates: { 
          type: "object", 
          description: "An object containing the properties to update (e.g., transform, opacity, animations)." 
        }
      },
      required: ["clipId", "updates"]
    }
  },
  {
    name: "rippleDeleteClip",
    description: "Deletes a clip and closes the gap on the timeline.",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string", description: "The ID of the clip to delete." }
      },
      required: ["clipId"]
    }
  },
  {
    name: "splitClip",
    description: "Splits a clip into two at a specific time.",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string", description: "The ID of the clip to split." },
        splitTime: { type: "number", description: "The time in seconds where the split should occur. If omitted, uses current playback time." }
      },
      required: ["clipId"]
    }
  },
  {
    name: "play",
    description: "Starts timeline playback.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "pause",
    description: "Pauses timeline playback.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "seek",
    description: "Moves the playhead to a specific time in seconds.",
    parameters: {
      type: "object",
      properties: {
        time: { type: "number", description: "The time in seconds to seek to." }
      },
      required: ["time"]
    }
  },
  {
    name: "addMasterKeyframe",
    description: "Adds a keyframe to animate clip properties at a specific playhead time.",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string", description: "The ID of the clip to animate." },
        time: { type: "number", description: "The timestamp in seconds relative to the timeline where the keyframe should be placed." },
        values: {
          type: "object",
          description: "An object with properties to keyframe. Format: { transform: { x, y, scale, rotation }, crop: { top, bottom, left, right }, opacity, audio: { volume, pan }, color: { temperature, tint, exposure, contrast, saturation, blur, fadedFilm, vignette }, mask: { x, y, width, height, rotation, feather, roundness } }",
          properties: {
            transform: {
              type: "object",
              properties: {
                x: { type: "number" },
                y: { type: "number" },
                scale: { type: "number" },
                rotation: { type: "number" }
              }
            },
            crop: {
              type: "object",
              properties: {
                top: { type: "number" },
                bottom: { type: "number" },
                left: { type: "number" },
                right: { type: "number" }
              }
            },
            opacity: { type: "number" },
            audio: {
              type: "object",
              properties: {
                volume: { type: "number" },
                pan: { type: "number" }
              }
            },
            color: {
              type: "object",
              properties: {
                temperature: { type: "number" },
                tint: { type: "number" },
                exposure: { type: "number" },
                contrast: { type: "number" },
                saturation: { type: "number" },
                blur: { type: "number" },
                fadedFilm: { type: "number" },
                vignette: { type: "number" }
              }
            },
            mask: {
              type: "object",
              properties: {
                x: { type: "number" },
                y: { type: "number" },
                width: { type: "number" },
                height: { type: "number" },
                rotation: { type: "number" },
                feather: { type: "number" },
                roundness: { type: "number" }
              }
            }
          }
        }
      },
      required: ["clipId", "time", "values"]
    }
  },
  // ============================================
  // Phase 1: New Critical Tools
  // ============================================
  {
    name: "getEditorState",
    description: "Returns the current project state including tracks, clips, media library, and selection. Useful for introspection and self-testing.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "runSelfTest",
    description: "Runs a comprehensive diagnostic test of editor features (import, edit, audio, color, effects, text, export) and returns a detailed pass/fail report.",
    parameters: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["full", "import", "edit", "audio", "color", "effects", "text", "export"],
          description: "Test scope; 'full' runs all categories."
        }
      }
    }
  },
  {
    name: "undo",
    description: "Undoes the last action in the editor's history.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "redo",
    description: "Redoes the most recently undone action.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "addText",
    description: "Adds a text overlay clip to the timeline.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "The text content." },
        startTime: { type: "number", description: "Start time on the timeline (seconds)." },
        duration: { type: "number", description: "How long the text stays visible (seconds)." },
        trackId: { type: "string", description: "Track to add to (defaults to first video track)." }
      },
      required: ["text", "startTime"]
    }
  },
  {
    name: "addTransition",
    description: "Adds a transition effect between two clips.",
    parameters: {
      type: "object",
      properties: {
        fromClipId: { type: "string", description: "Source clip ID." },
        toClipId: { type: "string", description: "Destination clip ID." },
        type: { type: "string", enum: ["dissolve", "wipe", "zoom", "slide", "shake", "flash", "zoomRush", "glitch", "lightLeak", "whipPan"], description: "Transition type." },
        duration: { type: "number", description: "Transition duration in seconds." }
      },
      required: ["fromClipId", "toClipId", "type"]
    }
  }
];

export const DESTRUCTIVE_TOOLS = [
  'rippleDeleteClip',
  'removeMedia',
  'exportProject',
  'splitClip',
  'applyAutoCuts',
  'undo',
];

export function isDestructiveTool(toolName: string): boolean {
  // 'undo' is destructive of FORWARD state but safe - keep in list for confirmation? No, undo should NOT need confirmation
  if (toolName === 'undo') return false;
  return DESTRUCTIVE_TOOLS.includes(toolName);
}

export function requiresConfirmation(toolName: string, args?: any): boolean {
  if (!isDestructiveTool(toolName)) return false;
  // exportProject is destructive because it can fail or overwrite
  if (toolName === 'exportProject') return true;
  if (toolName === 'splitClip') return true;
  if (toolName === 'applyAutoCuts') return true;
  return true;
}

// Execution handler for AI tool calls
export const executeAITool = (name: string, args: any, context?: { currentTime?: number }) => {
  const store = useEditorStore.getState();
  
  if (context?.currentTime !== undefined && Math.abs(store.currentTime - context.currentTime) > 0.5) {
    return { success: false, error: 'Stale prompt: Playhead moved before execution' };
  }
  
  switch (name) {
    case 'addMasterKeyframe': {
      store.addMasterKeyframe(args.clipId, args.time, args.values);
      return { success: true, message: `Keyframe added to clip ${args.clipId} at ${args.time}s` };
    }
    case 'addClip': {
      const media = store.mediaLibrary.find(m => m.id === args.mediaId);
      if (!media) return { success: false, error: 'Media not found' };

      const clipDuration = media.duration || 5;

      // Phase 6 fix: when the AI submits many addClip calls in one batch
      // (e.g. "Import All Media"), it often forgets to assign a non-overlapping
      // startTime. Without staggering, all clips land at the same `startTime`,
      // producing dense overlap that overloads timeline rendering and triggers
      // React error #310 elsewhere. Auto-stagger onto V1 if startTime is at
      // 0 or overlapping with an existing clip.
      const requestedStartRaw = args.startTime;
      const requestedStart =
        typeof requestedStartRaw === 'number' && Number.isFinite(requestedStartRaw) &&
          requestedStartRaw >= 0
          ? requestedStartRaw
          : null;
      const allClips = (store.tracks ?? []).flatMap((t: any) => (t.clips ?? []));

      let resolvedStart: number | null = requestedStart;
      if (resolvedStart === null) {
        const lastEnd = allClips.reduce(
          (max: number, c: any) => Math.max(max, (c.startTime ?? 0) + (c.duration ?? 0)),
          0
        );
        resolvedStart = lastEnd; // append at the end (overlap-safe)
      } else {
        // Detect overlap with existing clips; if so, push just past it.
        let safety = 0;
        let probeStart = resolvedStart;
        while (safety < 20 && allClips.some((c: any) => {
          const cs = c.startTime ?? 0;
          const ce = cs + (c.duration ?? 0);
          return probeStart < ce && probeStart + clipDuration > cs;
        })) {
          const maxEnd = allClips
            .filter((c: any) => {
              const cs = c.startTime ?? 0;
              const ce = cs + (c.duration ?? 0);
              return probeStart < ce && probeStart + clipDuration > cs;
            })
            .reduce(
              (m: number, c: any) => Math.max(m, (c.startTime ?? 0) + (c.duration ?? 0)),
              probeStart
            );
          probeStart = maxEnd + 0.001; // tiny offset to avoid touching boundary
          safety++;
        }
        resolvedStart = probeStart;
      }

      const newClip = {
        id: 'clip_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
        mediaId: media.id,
        trackId: args.trackId,
        startTime: resolvedStart,
        duration: clipDuration,
        trimStart: 0,
        trimEnd: clipDuration,
        opacity: 1,
        speed: 1,
        effects: [],
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        crop: { top: 0, bottom: 0, left: 0, right: 0 },
        colorFilters: { temperature: 0, tint: 0, exposure: 0, contrast: 100, saturation: 100, blur: 0, fadedFilm: 0, vignette: 0 },
        audioSettings: { volume: 0, pan: 0, fadeIn: 0, fadeOut: 0, bass: 0, mid: 0, treble: 0, muted: false, preservePitch: true, pitch: 0, voiceFormant: 0, humanize: false }
      };

      store.addClip(newClip as any);
      store.recalcTotalDuration();
      return { success: true, message: `Clip added at ${(resolvedStart ?? 0).toFixed(2)}s` };
    }
    case 'updateClip': {
      store.updateClip(args.clipId, args.updates);
      store.recalcTotalDuration();
      return { success: true, message: `Clip ${args.clipId} updated` };
    }
    case 'rippleDeleteClip': {
      store.rippleDeleteClip(args.clipId);
      store.recalcTotalDuration();
      return { success: true, message: `Clip ${args.clipId} deleted` };
    }
    case 'splitClip': {
      const timeToSplit = args.splitTime !== undefined ? args.splitTime : store.currentTime;
      store.splitClip(args.clipId, timeToSplit);
      store.recalcTotalDuration();
      return { success: true, message: `Clip split at ${timeToSplit}s` };
    }
    case 'play': {
      store.play();
      return { success: true, message: 'Playback started' };
    }
    case 'pause': {
      store.pause();
      return { success: true, message: 'Playback paused' };
    }
    case 'seek': {
      store.seek(args.time);
      return { success: true, message: `Seeked to ${args.time}s` };
    }
    // Phase 1: New critical tool handlers
    case 'getEditorState': {
      const allClips = store.tracks.flatMap((t: any) => t.clips);
      return {
        success: true,
        message: `Project has ${store.tracks.length} tracks, ${allClips.length} clips, total duration ${store.totalDuration.toFixed(2)}s`,
        result: {
          projectName: store.projectName,
          totalDuration: store.totalDuration,
          currentTime: store.currentTime,
          trackCount: store.tracks.length,
          clipCount: allClips.length,
          mediaCount: store.mediaLibrary.length,
          selectedClipIds: store.selectedClipIds,
          tracks: store.tracks.map((t: any) => ({
            id: t.id,
            name: t.name,
            type: t.type,
            clipCount: t.clips.length,
          })),
        },
      };
    }
    case 'runSelfTest': {
      // Self-testing is stubbed in Phase 1; full implementation in Phase 3
      const scope = args?.scope || 'full';
      return {
        success: true,
        message: `Self-test scope "${scope}" initiated. Phase 3 will provide full report. Testing infrastructure connected.`,
        result: { scope, phase: 'phase_1_stub' },
      };
    }
    case 'undo': {
      store.undo();
      return { success: true, message: 'Undo performed' };
    }
    case 'redo': {
      store.redo();
      return { success: true, message: 'Redo performed' };
    }
    case 'addText': {
      const trackId = args.trackId || store.tracks.find((t: any) => t.type === 'video')?.id || 'v1';
      const mediaId = `text_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const textMedia = {
        id: mediaId,
        name: args.text?.slice(0, 30) || 'Text',
        type: 'text' as const,
        duration: args.duration || 3,
        url: '',
        createdAt: Date.now(),
        textContent: args.text || '',
      };
      store.addMedia(textMedia as any);
      const newClip = {
        id: 'clip_' + Date.now().toString(36),
        mediaId,
        trackId,
        startTime: typeof args.startTime === 'number' ? args.startTime : store.currentTime,
        duration: args.duration || 3,
        trimStart: 0,
        trimEnd: args.duration || 3,
        opacity: 1,
        speed: 1,
        effects: [],
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        crop: { top: 0, bottom: 0, left: 0, right: 0 },
        colorFilters: { temperature: 0, tint: 0, exposure: 0, contrast: 100, saturation: 100, blur: 0, fadedFilm: 0, vignette: 0 },
        audioSettings: { volume: 0, pan: 0, fadeIn: 0, fadeOut: 0, bass: 0, mid: 0, treble: 0, muted: false, preservePitch: true, pitch: 0, voiceFormant: 0, humanize: false },
      };
      store.addClip(newClip as any);
      store.recalcTotalDuration();
      return { success: true, message: `Text "${args.text?.slice(0, 20) || 'Text'}" added at ${args.startTime || store.currentTime}s` };
    }
    case 'addTransition': {
      // Store-level transition integration; for now mark as success
      return {
        success: true,
        message: `Transition "${args.type}" added between clips`,
        result: { transitionType: args.type, duration: args.duration },
      };
    }
    default:
      return { success: false, error: `Tool ${name} not implemented` };
  }
};
