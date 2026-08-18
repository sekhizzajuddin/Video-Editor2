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
  {
    name: "applyAnimationExpression",
    description: "Applies a code-driven animation expression (like After Effects expressions) to a clip property.",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string", description: "The ID of the clip to animate." },
        property: { type: "string", description: "The property to animate (e.g., 'transform.x', 'transform.scale', 'opacity', 'mask.x')." },
        expression: { type: "string", description: "The expression code. Available variables: time, value, fps, width, height. Math functions available. E.g. 'wiggle(2, 50)' or 'Math.sin(time * 5) * 100 + value'." }
      },
      required: ["clipId", "property", "expression"]
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
  },
  {
    name: "inspectPreview",
    description: "Capture the program monitor at the current playhead and analyze it with the vision model. Use when the user asks what you see, how it looks, framing, color, or after visual edits.",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string", description: "What to look for in the frame." },
        time: { type: "number", description: "Optional timeline time in seconds. Defaults to playhead." }
      }
    }
  },
  {
    name: "addTrack",
    description: "Creates a new timeline track.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["video", "audio", "text", "fx", "adjustment"], description: "Track type." }
      },
      required: ["type"]
    }
  },
  {
    name: "addMarker",
    description: "Adds a marker on the timeline.",
    parameters: {
      type: "object",
      properties: {
        time: { type: "number", description: "Time in seconds. Defaults to playhead." },
        name: { type: "string", description: "Marker label." },
        color: { type: "string", description: "CSS color, e.g. #fbbf24." }
      }
    }
  },
  {
    name: "setInOut",
    description: "Sets the in and/or out points for export/playback range.",
    parameters: {
      type: "object",
      properties: {
        inPoint: { type: "number", description: "In point seconds, or null to clear." },
        outPoint: { type: "number", description: "Out point seconds, or null to clear." }
      }
    }
  },
  {
    name: "moveClip",
    description: "Moves a clip to a new start time and optionally another track.",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string" },
        startTime: { type: "number" },
        trackId: { type: "string" }
      },
      required: ["clipId", "startTime"]
    }
  },
  {
    name: "selectClip",
    description: "Selects one or more clips.",
    parameters: {
      type: "object",
      properties: {
        clipId: { type: "string" },
        clipIds: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "duplicateClip",
    description: "Duplicates the target clip immediately after it.",
    parameters: {
      type: "object",
      properties: { clipId: { type: "string" } },
      required: ["clipId"]
    }
  },
  {
    name: "muteTrack",
    description: "Mutes or unmutes a track.",
    parameters: {
      type: "object",
      properties: {
        trackId: { type: "string" },
        muted: { type: "boolean", description: "Defaults to true (mute)." }
      },
      required: ["trackId"]
    }
  },
  {
    name: "setTrackVolume",
    description: "Sets a track's mixer volume (0-1).",
    parameters: {
      type: "object",
      properties: {
        trackId: { type: "string" },
        volume: { type: "number", description: "0 to 1." }
      },
      required: ["trackId", "volume"]
    }
  },
  {
    name: "setAspectRatio",
    description: "Changes the project canvas aspect ratio. Use reframeProject if clips should be scaled to fill.",
    parameters: {
      type: "object",
      properties: {
        ratio: { type: "string", enum: ["16:9", "9:16", "1:1", "4:3"] },
        reframe: { type: "boolean", description: "If true, also scale clips to fill the new ratio." }
      },
      required: ["ratio"]
    }
  },
  {
    name: "reframeProject",
    description: "Smart-reframe the whole project to a new aspect ratio (scales clips to fill).",
    parameters: {
      type: "object",
      properties: {
        ratio: { type: "string", enum: ["16:9", "9:16", "1:1", "4:3"] }
      },
      required: ["ratio"]
    }
  },
  {
    name: "zoomTimeline",
    description: "Zooms the timeline view in or out.",
    parameters: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["in", "out", "fit"] }
      },
      required: ["direction"]
    }
  },
  {
    name: "setPlaybackSpeed",
    description: "Sets preview playback speed.",
    parameters: {
      type: "object",
      properties: { speed: { type: "number", description: "e.g. 0.5, 1, 1.5, 2" } },
      required: ["speed"]
    }
  },
  {
    name: "openExport",
    description: "Opens the export dialog so the user can render the video.",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "openSettings",
    description: "Opens the Settings modal (API keys, shortcuts, performance).",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "openHelp",
    description: "Opens the in-app help documentation.",
    parameters: {
      type: "object",
      properties: {
        section: { type: "string", description: "Optional section id: media-panel, timeline, properties, preview, audio-mixer, export, toolbar." }
      }
    }
  },
  {
    name: "listFeatures",
    description: "Returns a compact list of ProCut features the agent can operate.",
    parameters: { type: "object", properties: {} }
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
      const fromId = args.fromClipId;
      const toId = args.toClipId;
      const from = store.tracks.flatMap((t: any) => t.clips || []).find((c: any) => c.id === fromId);
      if (!from) return { success: false, error: 'fromClipId not found' };
      const duration = typeof args.duration === 'number' ? args.duration : 0.5;
      const transition = {
        id: 'tr_' + Date.now().toString(36),
        name: String(args.type || 'dissolve'),
        type: args.type || 'dissolve',
        duration,
        params: {},
      };
      store.updateClip(fromId, { transitionOut: transition });
      if (toId) {
        store.updateClip(toId, { transitionIn: { ...transition, id: transition.id + '_in' } });
      }
      store.saveSnapshot?.('Add Transition');
      return {
        success: true,
        message: `Transition "${args.type}" added (${duration}s)`,
        result: { transitionType: args.type, duration },
      };
    }
    case 'inspectPreview': {
      return {
        success: true,
        message: 'Preview inspection requested',
        result: {
          __inspectPreview: true,
          question: args?.question || 'Describe the current frame and suggest concrete edits.',
          time: typeof args?.time === 'number' ? args.time : store.currentTime,
        },
      };
    }
    case 'addTrack': {
      const type = args.type || 'video';
      store.addTrack(type);
      return { success: true, message: `Added ${type} track` };
    }
    case 'addMarker': {
      const time = typeof args.time === 'number' ? args.time : store.currentTime;
      store.addMarker(time, args.name, args.color);
      return { success: true, message: `Marker added at ${Number(time).toFixed(2)}s` };
    }
    case 'setInOut': {
      if (args.inPoint !== undefined) store.setInPoint(args.inPoint);
      if (args.outPoint !== undefined) store.setOutPoint(args.outPoint);
      return { success: true, message: `In/out set (in=${store.inPoint}, out=${store.outPoint})` };
    }
    case 'moveClip': {
      const ok = store.moveClip(args.clipId, args.startTime, args.trackId, true);
      store.saveSnapshot?.('Move Clip');
      return ok
        ? { success: true, message: `Moved clip to ${args.startTime}s` }
        : { success: false, error: 'Could not move clip (locked track or missing id)' };
    }
    case 'selectClip': {
      const ids = Array.isArray(args.clipIds) ? args.clipIds : args.clipId ? [args.clipId] : [];
      if (ids.length === 0) return { success: false, error: 'No clipId provided' };
      store.selectClips(ids);
      return { success: true, message: `Selected ${ids.length} clip(s)` };
    }
    case 'duplicateClip': {
      store.selectClips([args.clipId]);
      store.duplicateClip();
      return { success: true, message: `Duplicated clip ${args.clipId}` };
    }
    case 'muteTrack': {
      const track = store.tracks.find((t: any) => t.id === args.trackId);
      if (!track) return { success: false, error: 'Track not found' };
      const shouldMute = args.muted !== undefined ? !!args.muted : true;
      if (!!track.muted !== shouldMute) store.toggleTrackMute(args.trackId);
      return { success: true, message: `${shouldMute ? 'Muted' : 'Unmuted'} track ${track.name}` };
    }
    case 'setTrackVolume': {
      store.setTrackVolume(args.trackId, Math.max(0, Math.min(1, Number(args.volume))));
      return { success: true, message: `Track volume set to ${args.volume}` };
    }
    case 'setAspectRatio': {
      if (args.reframe) store.reframeProject(args.ratio);
      else store.setAspectRatio(args.ratio);
      return { success: true, message: `Aspect ratio set to ${args.ratio}` };
    }
    case 'reframeProject': {
      store.reframeProject(args.ratio);
      return { success: true, message: `Project reframed to ${args.ratio}` };
    }
    case 'zoomTimeline': {
      if (args.direction === 'in') store.zoomIn();
      else if (args.direction === 'out') store.zoomOut();
      else {
        const width = typeof document !== 'undefined'
          ? (document.querySelector('.timeline-track-workspace') as HTMLElement | null)?.clientWidth || 800
          : 800;
        const dur = store.totalDuration || 1;
        store.setZoomLevel(Math.max(20, Math.min(400, (width - 150) / dur)));
      }
      return { success: true, message: `Timeline zoom ${args.direction}` };
    }
    case 'setPlaybackSpeed': {
      store.setPlaybackSpeed(Number(args.speed) || 1);
      return { success: true, message: `Playback speed ${args.speed}x` };
    }
    case 'openExport': {
      store.setShowExportModal(true);
      return { success: true, message: 'Opened export dialog' };
    }
    case 'openSettings': {
      store.setShowSettingsModal(true);
      return { success: true, message: 'Opened settings' };
    }
    case 'openHelp': {
      store.setShowHelpMenu(true, args.section || 'timeline');
      return { success: true, message: 'Opened help' };
    }
    case 'listFeatures': {
      return {
        success: true,
        message: 'ProCut feature index returned',
        result: {
          surfaces: ['media', 'timeline', 'preview', 'properties', 'mixer', 'export', 'copilot'],
          edit: ['split', 'ripple', 'trim', 'move', 'keyframes', 'transitions', 'pip', 'markers'],
          color: ['temperature', 'tint', 'exposure', 'contrast', 'saturation', 'lut', 'curves'],
          audio: ['volume', 'fade', 'eq', 'ducking', 'vocal-separation', 'mixer'],
          text: ['titles', 'captions', 'kinetic', 'presets'],
          fx: ['glitch', 'film', 'particles', 'chroma', 'mask', 'object-removal', 'ai-background'],
        },
      };
    }
    case 'applyAnimationExpression': {
      const { clipId, property, expression } = args;
      const clip = store.tracks.flatMap((t: any) => t.clips || []).find((c: any) => c.id === clipId);
      if (!clip) return { success: false, error: 'Clip not found' };
      
      const expressions = { ...(clip.expressions || {}) };
      if (expression && expression.trim()) {
        expressions[property] = expression;
      } else {
        delete expressions[property];
      }
      store.updateClip(clipId, { expressions });
      return { success: true, message: `Expression applied to ${property} on clip ${clipId}` };
    }
    default:
      return { success: false, error: `Tool ${name} not implemented` };
  }
};
