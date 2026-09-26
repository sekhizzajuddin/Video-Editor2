/**
 * ProCutFeatureDocs — The official internal capability and workflow registry for ProCut.
 *
 * Maps industry-standard NLE concepts (CapCut, Premiere Pro, DaVinci Resolve, After Effects)
 * to ProCut's proprietary data model, tool registry names, and exact execution payloads.
 */

export interface ProCutFeatureDoc {
  id: string;
  name: string;
  category: 'timeline' | 'animation' | 'audio' | 'color' | 'effects' | 'ai' | 'text';
  industryAliases: string[]; // e.g. ["speed ramping", "time remapping", "velocity curve"]
  summary: string;
  procutImplementation: string;
  differencesFromCapCut: string;
  toolToUse: string;
  payloadExample: Record<string, any>;
  tips: string[];
}

export const PROCUT_FEATURE_CATALOG: ProCutFeatureDoc[] = [
  {
    id: 'speed_frames',
    name: 'Speed Frames (ProCut Velocity & Speed Ramping)',
    category: 'timeline',
    industryAliases: ['speed ramping', 'velocity curve', 'time remapping', 'slow motion curve', 'fast motion curve'],
    summary: 'Non-destructive rate-stretching and time remapping by anchoring source media time to timeline offsets.',
    procutImplementation: 'In ProCut, speed ramping does NOT cut the clip or drag a simple curve graph. Instead, clips contain `speedFrames: Array<{ id, timelineOffset, sourceTime }>` where timelineOffset is seconds from clip start and sourceTime is the source media timestamp. The canvas engine stretches playback smoothly between these anchor points.',
    differencesFromCapCut: 'CapCut cuts or applies a preset bezier speed curve; ProCut embeds source-time anchors directly inside the clip without creating separate split clips.',
    toolToUse: 'updateClip',
    payloadExample: {
      clipId: 'clip-1',
      updates: {
        speedFrames: [
          { id: 'sf-1', timelineOffset: 1.0, sourceTime: 1.0 },
          { id: 'sf-2', timelineOffset: 2.5, sourceTime: 1.5 }, // slow-motion stretch
          { id: 'sf-3', timelineOffset: 3.5, sourceTime: 3.0 }, // speed burst
        ]
      }
    },
    tips: [
      'Use DynamicStretchOverlay to visualize speed frame anchors on the timeline.',
      'Always ensure 0 < timelineOffset < clip.duration.',
      'For global clip speed without ramping, use setPlaybackSpeed or updateClip with { speed: 1.5 }.'
    ]
  },
  {
    id: 'master_keyframes',
    name: 'Master Keyframes & Multi-Property Animation',
    category: 'animation',
    industryAliases: ['keyframe', 'animate transform', 'motion tween', 'scale zoom keyframe', 'opacity fade'],
    summary: 'Choreographs multi-property animations (transform, crop, opacity, color, audio, mask) at specific timeline playhead times.',
    procutImplementation: 'ProCut uses `addMasterKeyframe` with a structured values object containing transform (x, y, scale, rotation), crop, opacity, color, audio, and mask. Supports cubic bezier presets (easeIn, easeOut, easeInOut, overshoot) and spatial tangents.',
    differencesFromCapCut: 'CapCut places independent diamond keyframes per property; ProCut supports a unified master keyframe record that can animate transform, color, and audio together at a single timestamp.',
    toolToUse: 'addMasterKeyframe',
    payloadExample: {
      clipId: 'clip-1',
      time: 2.5,
      values: {
        transform: { x: 0, y: 0, scale: 1.15, rotation: 0 },
        opacity: 1.0,
        color: { exposure: 10, contrast: 105 }
      }
    },
    tips: [
      'For slow push-in (Ken Burns), set scale: 1.0 at clip start and scale: 1.08 at clip end.',
      'To ease keyframes, use bezier presets declared in bezierPresets.ts.'
    ]
  },
  {
    id: 'animation_expressions',
    name: 'Procedural Animation Expressions (After Effects Style)',
    category: 'animation',
    industryAliases: ['wiggle expression', 'math expression', 'code animation', 'after effects expressions', 'shake'],
    summary: 'Applies procedural JavaScript math expressions to animate clip properties dynamically without placing manual keyframes.',
    procutImplementation: 'Use `applyAnimationExpression`. Expressions run in real-time on every animation frame. Available variables: `time`, `value`, `fps`, `width`, `height`. Built-in math helpers include `wiggle(freq, amp)`, `Math.sin(time)`, `Math.cos(time)`.',
    differencesFromCapCut: 'CapCut has zero expression support and only offers static shake filters; ProCut allows mathematical code-driven motion.',
    toolToUse: 'applyAnimationExpression',
    payloadExample: {
      clipId: 'clip-1',
      property: 'transform.x',
      expression: 'wiggle(3, 20)'
    },
    tips: [
      'For camera handheld shake, apply wiggle(2, 15) to transform.x and wiggle(2, 10) to transform.y.',
      'For pulsing zoom, use Math.sin(time * 4) * 0.05 + 1.0 on transform.scale.'
    ]
  },
  {
    id: 'chroma_key',
    name: 'Chroma Key (Green Screen) with YUV & Spill Suppression',
    category: 'effects',
    industryAliases: ['green screen', 'chroma keying', 'background removal green', 'ultra key', 'color key'],
    summary: 'Removes solid background colors (green/blue screen) with YUV color space distance, spill suppression, and edge feathering.',
    procutImplementation: 'Configured via `ClipChromaKeySettings` inside clip updates: `{ enabled: true, color: "#00ff00", threshold: 45, softness: 15, spillSuppression: 30, edgeFeather: 2 }`. Runs inside CanvasRenderingEngine with YUV color distance and Gaussian alpha blur.',
    differencesFromCapCut: 'Uses YUV distance rather than simple RGB Euclidean distance to handle shadows and lighting variation without tearing subject edges.',
    toolToUse: 'updateClip',
    payloadExample: {
      clipId: 'clip-1',
      updates: {
        chromaKey: {
          enabled: true,
          color: '#00ff00',
          threshold: 40,
          softness: 15,
          spillSuppression: 25,
          edgeFeather: 2
        }
      }
    },
    tips: [
      'Increase spillSuppression to 40 if green light bounces onto the subject hair or clothes.',
      'Add edgeFeather: 2 for natural edge anti-aliasing.'
    ]
  },
  {
    id: 'kinetic_typography',
    name: 'Kinetic Typography & Animated Text Overlays',
    category: 'text',
    industryAliases: ['subtitles', 'animated captions', 'kinetic titles', 'lower third', 'typewriter text', 'pop text'],
    summary: 'High-production motion graphics and animated text overlays timed precisely to speech or scene moments.',
    procutImplementation: 'Use `addText` or `analyzeMotionGraphicsWithGemini`. Supported motion templates include: "kinetic_typewriter", "kinetic_bounce", "lower_third_classic", "cinematic_title", "subtitle_bar", "kinetic_pop", "subscribe_bell".',
    differencesFromCapCut: 'Templates render directly into the composite canvas pipeline with custom easing curves and frame-accurate playback.',
    toolToUse: 'addText',
    payloadExample: {
      text: 'Breaking News: AI Video Editor',
      startTime: 0.0,
      duration: 3.5,
      trackId: 'v2'
    },
    tips: [
      'Place text clips on track v2 or higher so they overlay on top of video clips on v1.'
    ]
  },
  {
    id: 'transitions_engine',
    name: 'Seamless Scene Transitions',
    category: 'timeline',
    industryAliases: ['transition', 'crossfade', 'dissolve', 'whip pan', 'zoom rush', 'glitch transition', 'wipe'],
    summary: 'Blends between two adjacent clips using GLSL and Canvas composite transition shaders.',
    procutImplementation: 'Call `addTransition` with `fromClipId`, `toClipId`, `type`, and `duration`. Supported types: "dissolve", "wipe", "zoom", "shake", "flash", "zoomRush", "glitch", "lightLeak", "whipPan".',
    differencesFromCapCut: 'Transitions link directly between clip IDs and interpolate seamlessly during scrubbing as well as playback.',
    toolToUse: 'addTransition',
    payloadExample: {
      fromClipId: 'clip-1',
      toClipId: 'clip-2',
      type: 'zoomRush',
      duration: 0.5
    },
    tips: [
      'For high-energy vlogs or reels, use whipPan or zoomRush.',
      'For cinematic documentary cuts, use dissolve with 0.8s duration.'
    ]
  },
  {
    id: 'ai_speed_sync',
    name: 'AI Speed Sync (TTS Voiceover Lip Pacing)',
    category: 'ai',
    industryAliases: ['audio video sync', 'sync video with TTS', 'match video to voiceover', 'lip sync speed'],
    summary: 'Synchronizes a video clip playback speed to a TTS voiceover so sentence pacing and lip motion match.',
    procutImplementation: 'Uses sentence splitting, Gemini cascade alignment, and speed-frame anchors to stretch/compress video segments so video actions align with spoken voiceover cues.',
    differencesFromCapCut: 'CapCut requires manual razor cuts and speed sliders; ProCut aligns sentence audio peaks directly to video frames.',
    toolToUse: 'updateClip',
    payloadExample: {
      clipId: 'clip-1',
      updates: { speed: 1.12 }
    },
    tips: [
      'Accessible via the AI Speed Sync Modal in the top toolbar.'
    ]
  },
  {
    id: 'compound_clips',
    name: 'Nested Compound Clips',
    category: 'timeline',
    industryAliases: ['compound clip', 'nested sequence', 'pre-compose', 'group tracks', 'sub-timeline'],
    summary: 'Collapses multiple tracks and clips into a single compound clip with re-entrant editing.',
    procutImplementation: 'Clips can hold `nestedTimeline: TimelineTrack[]`. Use `enterCompoundClip` to open the sub-timeline for isolated editing.',
    differencesFromCapCut: 'Matches DaVinci Resolve Compound Clips and Final Cut Pro compound sequences.',
    toolToUse: 'updateClip',
    payloadExample: {
      clipId: 'compound-1',
      updates: { isPreview: false }
    },
    tips: [
      'Great for organizing complex multi-track scenes into a single draggable block.'
    ]
  }
];

export class ProCutFeatureDocs {
  /**
   * Search the internal catalog by user query or generic industry terms.
   */
  public static search(query: string, category?: string): ProCutFeatureDoc[] {
    const q = query.toLowerCase().trim();
    if (!q) return PROCUT_FEATURE_CATALOG;

    return PROCUT_FEATURE_CATALOG.filter((doc) => {
      if (category && doc.category !== category) return false;

      // Check title & summary
      if (doc.name.toLowerCase().includes(q) || doc.summary.toLowerCase().includes(q)) return true;

      // Check industry aliases (e.g. "speed ramping")
      if (doc.industryAliases.some(alias => alias.toLowerCase().includes(q) || q.includes(alias.toLowerCase()))) return true;

      // Check implementation details
      if (doc.procutImplementation.toLowerCase().includes(q) || doc.differencesFromCapCut.toLowerCase().includes(q)) return true;

      return false;
    });
  }

  /**
   * Get formatted CLI markdown output for a given command.
   */
  public static runCommand(command: string): { output: string; matchedDocs?: ProCutFeatureDoc[] } {
    const trimmed = command.trim();
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const arg = parts.slice(1).join(' ').toLowerCase();

    switch (cmd) {
      case 'help':
      case 'man':
      case 'docs': {
        if (!arg) {
          return {
            output: `Available ProCut Documentation Topics:\n` +
              PROCUT_FEATURE_CATALOG.map(d => `  • ${d.name} [ID: ${d.id}] (${d.industryAliases.slice(0, 2).join(', ')})`).join('\n') +
              `\n\nUsage: docs <topic> (e.g., "docs speed ramp", "docs keyframe", "docs green screen")`
          };
        }
        const matches = this.search(arg);
        if (matches.length === 0) {
          return { output: `No documentation found for "${arg}". Try "list" to see all features.` };
        }
        const top = matches[0];
        return {
          output: `### ${top.name}\n` +
            `**Category:** ${top.category.toUpperCase()}\n` +
            `**Industry Synonyms:** ${top.industryAliases.join(', ')}\n\n` +
            `**Summary:** ${top.summary}\n\n` +
            `**ProCut Implementation:**\n${top.procutImplementation}\n\n` +
            `**Difference from CapCut/Premiere:**\n${top.differencesFromCapCut}\n\n` +
            `**Tool to Call:** \`${top.toolToUse}\`\n\n` +
            `**Payload Example:**\n\`\`\`json\n${JSON.stringify(top.payloadExample, null, 2)}\n\`\`\`\n\n` +
            `**Pro Tips:**\n${top.tips.map(t => `- ${t}`).join('\n')}`,
          matchedDocs: matches
        };
      }

      case 'list': {
        const cat = arg || undefined;
        const list = this.search('', cat);
        return {
          output: `ProCut Feature Index (${list.length} features):\n` +
            list.map(d => `• [${d.category.toUpperCase()}] ${d.name} -> calls "${d.toolToUse}"`).join('\n')
        };
      }

      case 'synonyms': {
        return {
          output: `CapCut / Premiere -> ProCut Terminology Mapping:\n` +
            PROCUT_FEATURE_CATALOG.map(d => `• "${d.industryAliases[0]}" -> ProCut "${d.name}"`).join('\n')
        };
      }

      default: {
        // Fallback to fuzzy search
        const matches = this.search(trimmed);
        if (matches.length > 0) {
          return this.runCommand(`docs ${matches[0].id}`);
        }
        return {
          output: `Unknown command: "${command}". Available commands:\n` +
            `  • docs <topic> - View detailed specification & tool payload\n` +
            `  • list [category] - List all internal features\n` +
            `  • synonyms - Show CapCut/Premiere to ProCut vocabulary map\n` +
            `  • search <query> - Search capabilities`
        };
      }
    }
  }
}
