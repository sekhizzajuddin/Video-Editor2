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
  }
];

// Execution handler for AI tool calls
export const executeAITool = (name: string, args: any) => {
  const store = useEditorStore.getState();
  
  switch (name) {
    case 'addMasterKeyframe': {
      store.addMasterKeyframe(args.clipId, args.time, args.values);
      return { success: true, message: `Keyframe added to clip ${args.clipId} at ${args.time}s` };
    }
    case 'addClip': {
      const media = store.mediaLibrary.find(m => m.id === args.mediaId);
      if (!media) return { success: false, error: 'Media not found' };
      
      const newClip = {
        id: 'clip_' + Date.now().toString(36),
        mediaId: media.id,
        trackId: args.trackId,
        startTime: args.startTime,
        duration: media.duration || 5,
        trimStart: 0,
        trimEnd: media.duration || 5,
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
      return { success: true, message: `Clip added at ${args.startTime}s` };
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
    default:
      return { success: false, error: `Tool ${name} not implemented` };
  }
};
