import { useCallback } from 'react';
import { useEditorStore } from '@/store/editorStore';
import type { TimelineClip, ParticleEffectType, ClipParticleSettings } from '@/types';
import { MOTION_TEMPLATES } from '@/utils/motionTemplates';
import { FX_EFFECTS } from '@/constants/mediaPanel';
import { toast } from 'sonner';
import { generateId } from '../timelineUtils';
import { getTrackAtY } from '../trackGeometry';
import { DEFAULT_TRACK_HEIGHT, THIN_TRACK_HEIGHT } from '../timelineConstants';
import type { TimelineState } from './useTimelineState';

interface UseTimelineDropDeps {
  timelineState: TimelineState;
}

export function useTimelineDrop({ timelineState }: UseTimelineDropDeps) {
  const zoomLevel = useEditorStore((state) => state.zoomLevel);
  const tracks = useEditorStore((state) => state.tracks);

  const {
    setHoveredTrackId,
    setDropPreview,
  } = timelineState;

  const handleDrop = useCallback(
    (e: React.DragEvent, trackId: string) => {
      e.preventDefault();
      e.stopPropagation();
      // Clear the dragging media tracker set in MediaPanel's onDragStart
      (window as any).__procutDraggingMediaId = undefined;
      const state = useEditorStore.getState();
      let track = state.tracks.find((t) => t.id === trackId);
      if (!track && state.pipWindows) {
        for (const pip of Object.values(state.pipWindows)) {
          if (!pip) continue;
          const pt = pip.tracks.find(t => t.id === trackId);
          if (pt) {
            track = pt;
            break;
          }
        }
      }
      if (!track && !e.dataTransfer.types.includes('application/procut-media') && !e.dataTransfer.types.includes('Files') && !e.dataTransfer.types.includes('application/procut-media-sequence') && !e.dataTransfer.types.includes('application/procut-effect') && !e.dataTransfer.types.includes('application/procut-custom-fx')) {
        // Only return early if track is missing AND we are dropping something that strictly requires a track (like transitions)
        // Media items, files, templates, and FX can be dropped on empty space to auto-create tracks.
        const hasTemplate = e.dataTransfer.getData('application/procut-template');
        if (!hasTemplate) {
          // P3 FIX: clear the stale ghost/highlight — the drop ended here but the
          // gray highlight and ghost clip used to remain rendered.
          setHoveredTrackId(null);
          setDropPreview(null);
          return;
        }
      }

      // P3 FIX: container-level drop (empty space) used to discard the drop x
      // position entirely — addClip auto-appended to the END of the first valid
      // track. Resolve the hovered track from the Y coordinate instead.
      if (!track && trackId === '') {
        const container = (e.currentTarget as HTMLElement);
        const containerRect = container.getBoundingClientRect();
        const relY = e.clientY - containerRect.top + container.scrollTop;
        const idx = getTrackAtY(state.tracks, relY);
        const resolvedTrack = idx >= 0 && idx < state.tracks.length ? state.tracks[idx] : null;
        if (resolvedTrack && !resolvedTrack.locked) {
          track = resolvedTrack;
        }
      }

      // ── Transition drop → apply to closest clip boundary ──
      const transitionName = e.dataTransfer.getData('application/procut-transition');
      if (transitionName && track && track.type === 'video') {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const dropTime = Math.max(0, x / zoomLevel);
        
        let closestClip: typeof track.clips[0] | null = null;
        let isStart = true;
        let minDistance = Infinity;

        // Find the absolute closest clip boundary (start or end) to the drop point
        for (const c of track.clips) {
          const distStart = Math.abs(dropTime - c.startTime);
          if (distStart < minDistance) {
            minDistance = distStart;
            closestClip = c;
            isStart = true;
          }
          const distEnd = Math.abs(dropTime - (c.startTime + c.duration));
          if (distEnd < minDistance) {
            minDistance = distEnd;
            closestClip = c;
            isStart = false;
          }
        }

        // P3 FIX: threshold scaled in PIXELS, not seconds — the old 5s threshold
        // meant 2000px at zoom 400 (dropping "anywhere nearby" attached) vs
        // 100px at zoom 20.
        if (closestClip && minDistance * zoomLevel < 40) { // Apply if dropped within ~40px of a boundary
          const nameLower = transitionName.toLowerCase();
          const type = nameLower.includes('dissolve') ? 'dissolve'
                     : nameLower.includes('wipe') ? 'wipe'
                     : nameLower.includes('zoomrush') ? 'zoomRush'
                     : nameLower.includes('zoom') ? 'zoom'
                     : nameLower.includes('slide') ? 'slide'
                     : nameLower.includes('shake') ? 'shake'
                     : nameLower.includes('flash') ? 'flash'
                     : nameLower.includes('glitch') ? 'glitch'
                     : nameLower.includes('light leak') ? 'lightLeak'
                     : nameLower.includes('whip pan') ? 'whipPan'
                     : nameLower.includes('pixelate') ? 'pixelate'
                     : nameLower.includes('mirror') ? 'mirror'
                     : 'dissolve';
                     
          const newTransition = {
            id: Math.random().toString(36).substr(2, 9),
            name: transitionName,
            type: type as any,
            duration: 1.0,
            params: {},
          };

          if (isStart) {
            useEditorStore.getState().updateClip(closestClip.id, { transitionIn: newTransition });
          } else {
            useEditorStore.getState().updateClip(closestClip.id, { transitionOut: newTransition });
          }
          useEditorStore.getState().saveSnapshot();
        }
        setHoveredTrackId(null);
        setDropPreview(null);
        return;
      }

      // ── Color Correction Preset drop ──
      const colorPresetRaw = e.dataTransfer.getData('application/procut-color-preset');
      if (colorPresetRaw && track && (track.type === 'video' || track.type === 'audio')) {
        try {
          const preset = JSON.parse(colorPresetRaw) as Record<string, number>;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          // P3 FIX: clamp — this was the only unclamped x / zoomLevel division
          const dropTime = Math.max(0, x / zoomLevel);
          
          const hitClip = track.clips.find(
            (c) => dropTime >= c.startTime && dropTime < c.startTime + c.duration
          );
          if (hitClip) {
            const existing = hitClip.colorFilters ?? {
              temperature: 0, tint: 0, exposure: 0, contrast: 100,
              saturation: 100, blur: 0, fadedFilm: 0, vignette: 0,
            };
            useEditorStore.getState().updateClip(hitClip.id, {
              colorFilters: { ...existing, ...preset },
            });
            useEditorStore.getState().saveSnapshot();
          }
        } catch { /* ignore parse errors */ }
        setHoveredTrackId(null);
        setDropPreview(null);
        return;
      }

      // ── Particle effect drop ──
      const particleType = e.dataTransfer.getData('application/procut-particle');
      if (particleType && track && (track.type === 'video')) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const dropTime = x / zoomLevel;

        const PARTICLE_DEFAULTS: Record<string, Omit<ClipParticleSettings, 'type'|'emitterX'|'emitterY'>> = {
          snow:      { amount: 120, speed: 40,  intensity: 80, size: 100, gravity: 20,  wind: 5,  spread: 180, lifetime: 150, color: '#ffffff', colorVariance: 15, glow: false, turbulence: 20 },
          rain:      { amount: 200, speed: 160, intensity: 70, size: 100, gravity: 100, wind: 15, spread: 10,  lifetime: 60,  color: '#a0c8ff', colorVariance: 10, glow: false, turbulence: 5  },
          fire:      { amount: 80,  speed: 80,  intensity: 90, size: 130, gravity: -60, wind: 0,  spread: 60,  lifetime: 80,  color: '#ff6a00', colorVariance: 60, glow: true,  turbulence: 60 },
          sparkles:  { amount: 60,  speed: 50,  intensity: 85, size: 80,  gravity: -10, wind: 0,  spread: 360, lifetime: 100, color: '#ffd700', colorVariance: 30, glow: true,  turbulence: 30 },
          confetti:  { amount: 100, speed: 60,  intensity: 90, size: 100, gravity: 40,  wind: 10, spread: 90,  lifetime: 200, color: 'auto',    colorVariance: 100, glow: false, turbulence: 40 },
          smoke:     { amount: 30,  speed: 25,  intensity: 60, size: 200, gravity: -30, wind: 8,  spread: 30,  lifetime: 200, color: '#888888', colorVariance: 20, glow: false, turbulence: 70 },
          bubbles:   { amount: 40,  speed: 30,  intensity: 70, size: 120, gravity: -40, wind: 5,  spread: 60,  lifetime: 180, color: '#80ffff', colorVariance: 20, glow: true,  turbulence: 15 },
          leaves:    { amount: 50,  speed: 35,  intensity: 80, size: 110, gravity: 30,  wind: 20, spread: 45,  lifetime: 180, color: '#ff7b00', colorVariance: 70, glow: false, turbulence: 50 },
          hearts:    { amount: 30,  speed: 25,  intensity: 85, size: 100, gravity: -20, wind: 5,  spread: 40,  lifetime: 200, color: '#ff4d88', colorVariance: 25, glow: true,  turbulence: 20 },
          matrix:    { amount: 40,  speed: 80,  intensity: 90, size: 100, gravity: 80,  wind: 0,  spread: 0,   lifetime: 120, color: '#00ff41', colorVariance: 10, glow: true,  turbulence: 0  },
        };
        const defaults = PARTICLE_DEFAULTS[particleType] ?? PARTICLE_DEFAULTS.sparkles;

        const hitClip = track.clips.find(
          (c) => dropTime >= c.startTime && dropTime < c.startTime + c.duration
        );
        if (hitClip) {
          useEditorStore.getState().updateClip(hitClip.id, {
            particleSettings: {
              type: particleType as ParticleEffectType,
              emitterX: 50,
              emitterY: 100,
              ...defaults,
            },
          });
          useEditorStore.getState().selectClip(hitClip.id);
          useEditorStore.getState().saveSnapshot();
        }
        setHoveredTrackId(null);
        setDropPreview(null);
        return;
      }

      // ── Animated Title Template drop ──
      const templateId = e.dataTransfer.getData('application/procut-template');
      if (templateId) {
        const tmpl = MOTION_TEMPLATES.find((t) => t.id === templateId);
        if (tmpl && track) {
          if (tmpl.type === 'video') {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            const dropTime = Math.max(0, x / zoomLevel);
            const targetClip = track.clips.find(c => dropTime >= c.startTime && dropTime <= c.startTime + c.duration);
            
            if (targetClip) {
              const updates: any = {};
              if (tmpl.category === 'color-preset' && tmpl.colorFilters) {
                updates.colorFilters = { ...tmpl.colorFilters };
                toast.success(`Applied color preset "${tmpl.name}" to video clip`);
              } else if (tmpl.category === 'particle' && tmpl.particleSettings) {
                updates.particleSettings = { ...tmpl.particleSettings };
                toast.success(`Applied particle preset "${tmpl.name}" to video clip`);
              } else if (tmpl.category === 'fx-overlay' && tmpl.fxSettings) {
                updates.fxSettings = { ...tmpl.fxSettings };
                toast.success(`Applied effect "${tmpl.name}" to video clip`);
              }
              
              useEditorStore.getState().updateClip(targetClip.id, updates);
              useEditorStore.getState().saveSnapshot();
            } else {
              toast.error("Drop the video template directly onto a video clip on the timeline.");
            }
          } else {
            let targetTrack = track;
            if (track.type !== 'text') {
              const existingTextTrack = useEditorStore.getState().tracks.find((t) => t.type === 'text');
              if (existingTextTrack) {
                targetTrack = existingTextTrack;
              } else {
                useEditorStore.getState().addTrack('text');
                targetTrack = useEditorStore.getState().tracks.find((t) => t.type === 'text') || track;
              }
            }
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            const startTime = Math.max(0, x / zoomLevel);
            const mediaId = `tmpl_media_${Math.random().toString(36).substr(2, 9)}`;
            const clipId  = `tmpl_clip_${Math.random().toString(36).substr(2, 9)}`;
            useEditorStore.getState().addMedia({
              id: mediaId,
              name: tmpl.name,
              type: 'text',
              duration: tmpl.defaultDuration,
              url: '',
              createdAt: Date.now(),
            });
            useEditorStore.getState().addClip({
              id: clipId,
              mediaId,
              trackId: targetTrack.id,
              startTime,
              duration: tmpl.defaultDuration,
              trimStart: 0,
              trimEnd: 0,
              transform: { x: 0, y: 0, scale: 100, rotation: 0 },
              opacity: 1,
              speed: 1,
              effects: [],
              textSettings: { ...tmpl.textSettings },
              animations: tmpl.animations ? { ...tmpl.animations } : undefined,
            } as any);
            useEditorStore.getState().selectClip(clipId);
            useEditorStore.getState().saveSnapshot();
          }
        }
        setHoveredTrackId(null);
        setDropPreview(null);
        return;
      }

      // ── Custom AI FX Drop (Attach directly as sub-track to target clip) ──
      const customFxRaw = e.dataTransfer.getData('application/procut-custom-fx');
      if (customFxRaw) {
        try {
          const customFx = JSON.parse(customFxRaw);
          const state = useEditorStore.getState();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          const dropTime = Math.max(0, x / zoomLevel);

          let targetClip: TimelineClip | null = null;
          if (track) {
            targetClip = track.clips.find((c) => dropTime >= c.startTime && dropTime < c.startTime + c.duration) || null;
          }
          if (!targetClip) {
            for (const t of state.tracks) {
              if (t.type === 'video' || t.type === 'text') {
                const c = t.clips.find((clip) => dropTime >= clip.startTime && dropTime < clip.startTime + clip.duration);
                if (c) { targetClip = c; break; }
              }
            }
          }

          if (targetClip) {
            state.updateClip(targetClip.id, {
              fxSettings: {
                type: 'custom_html',
                intensity: 100,
                customFxId: customFx.id,
                customHtmlCss: customFx.htmlCss,
                customFxName: customFx.name,
                enabled: true,
                isCollapsed: false,
              },
            });
            state.selectClip(targetClip.id);
            state.saveSnapshot('Apply Custom FX to Clip');
            setHoveredTrackId(null);
            setDropPreview(null);
            toast.success(`✨ Applied "${customFx.name}" to ${(targetClip as any).name || targetClip.id}`);
            return;
          } else {
            toast.info('Drop onto a video or image clip to attach this FX');
            setHoveredTrackId(null);
            setDropPreview(null);
            return;
          }
        } catch (err) {
          console.error('Failed to parse custom fx drop', err);
        }
      }

      // ── VFX Effect Drop ──
      const effectName = e.dataTransfer.getData('application/procut-effect');
      if (effectName) {
        const state = useEditorStore.getState();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const dropTime = Math.max(0, x / zoomLevel);

        let targetTrackId: string;
        let targetClip: TimelineClip | null = null;

        if (track) {
          if (track.type === 'video' || track.type === 'text') {
            // Dropped onto a video/text track: snap to clip under cursor, ensure FX track directly above
            targetClip = track.clips.find((c) => dropTime >= c.startTime && dropTime < c.startTime + c.duration) || null;
            targetTrackId = state.ensureFxTrackAbove(track.id);
          } else if (track.type === 'fx') {
            targetTrackId = track.id;
            if (track.linkedTrackId) {
              const hostTrack = state.tracks.find((t) => t.id === track.linkedTrackId);
              if (hostTrack) {
                targetClip = hostTrack.clips.find((c) => dropTime >= c.startTime && dropTime < c.startTime + c.duration) || null;
              }
            }
          } else {
            const existingFx = state.tracks.find((t) => t.type === 'fx');
            if (existingFx) {
              targetTrackId = existingFx.id;
            } else {
              const firstVideo = state.tracks.find((t) => t.type === 'video');
              targetTrackId = firstVideo
                ? state.ensureFxTrackAbove(firstVideo.id)
                : (state.addTrack('fx'), useEditorStore.getState().tracks.find((t) => t.type === 'fx')!.id);
            }
          }
        } else {
          const firstVideo = state.tracks.find((t) => t.type === 'video');
          targetTrackId = firstVideo
            ? state.ensureFxTrackAbove(firstVideo.id)
            : (state.addTrack('fx'), useEditorStore.getState().tracks.find((t) => t.type === 'fx')!.id);
        }

        const startTime = targetClip ? targetClip.startTime : dropTime;
        const duration = targetClip ? targetClip.duration : 5;

        const matchedFx = FX_EFFECTS.find(
          (fx) => fx.name.toLowerCase() === effectName.toLowerCase() || fx.type.toLowerCase() === effectName.toLowerCase()
        );
        const fxType = matchedFx?.type ?? effectName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const fxMediaId = generateId();
        state.addMedia({
          id: fxMediaId,
          name: matchedFx?.name || effectName,
          type: 'fx',
          duration,
          url: '',
          createdAt: Date.now(),
          fxType,
        });

        const fxClipId = generateId();
        const fxClip: TimelineClip = {
          id: fxClipId,
          mediaId: fxMediaId,
          trackId: targetTrackId,
          startTime,
          duration,
          trimStart: 0,
          trimEnd: 0,
          transform: { x: 0, y: 0, scale: 100, rotation: 0 },
          opacity: 1,
          speed: 1,
          effects: [],
          linkedClipId: targetClip ? targetClip.id : undefined,
          fxSettings: {
            type: fxType as any,
            intensity: matchedFx?.defaultSettings?.intensity ?? 100,
            ...(matchedFx?.defaultSettings || {}),
          },
        };
        state.addClip(fxClip);
        if (targetClip) {
          state.updateClip(targetClip.id, { linkedClipId: fxClipId });
        }
        state.selectClip(fxClipId);
        state.saveSnapshot('Add FX Clip');
        setHoveredTrackId(null);
        setDropPreview(null);
        toast.success(targetClip ? `Connected "${matchedFx?.name || effectName}" with clip` : `Added FX clip "${matchedFx?.name || effectName}" to FX track`);
        return;
      }

      // ── NEW: Sequence Drop (Multi-Image) ──
      const sequenceData = e.dataTransfer.getData('application/procut-media-sequence');
      if (sequenceData) {
        try {
          const mediaIds = JSON.parse(sequenceData);
          if (Array.isArray(mediaIds) && mediaIds.length >= 2) {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            const startTime = Math.max(0, x / zoomLevel);
            
            useEditorStore.getState().addImageSequence(mediaIds, {
              trackId,
              startTime,
              defaultClipDuration: 3,
              transitionType: 'kenburnsAuto'
            });
            setHoveredTrackId(null);
            setDropPreview(null);
            return; // Skip single-clip path
          }
        } catch (err) {
          console.error('Failed to parse sequence drop', err);
        }
      }

      // ── Direct File Drop from OS ──
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const startTime = Math.max(0, x / zoomLevel);

        (async () => {
          const { probeFile } = await import('@/utils/mediaProbe');
          // P3 FIX: the OS-file drop path performed ZERO validation — dropping a
          // .exe/.docx created a garbage "image" clip with a success toast. Same
          // whitelist as the MediaPanel import.
          const supportedExtensions = [
            '.mp4', '.webm', '.ogg', '.mov', '.mkv',
            '.mp3', '.wav', '.m4a', '.aac',
            '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg',
            '.cube'
          ];
          for (const file of files) {
            const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
            if (!supportedExtensions.includes(ext)) {
              toast.error(`Unsupported file type: ${file.name}`);
              continue;
            }
            let mediaItem: import('@/types').MediaItem | null = null;
            try {
              mediaItem = await probeFile(file);
              useEditorStore.getState().addMedia(mediaItem, file);
              const isText = mediaItem.type === 'text';
              const newClip: TimelineClip = {
                id: generateId(),
                mediaId: mediaItem.id,
                // P3 FIX: use the resolved track (container-level drops used to
                // pass trackId:'' and auto-append to the first valid track)
                trackId: track?.id || trackId,
                startTime,
                duration: isText ? 3 : (mediaItem.type === 'image' ? 5 : mediaItem.duration),
                trimStart: 0,
                trimEnd: 0,
                transform: { x: 0, y: 0, scale: 100, rotation: 0 },
                opacity: 1,
                speed: 1,
                effects: [],
              };
              useEditorStore.getState().addClip(newClip);
              toast.success(`Imported: ${file.name}`);
            } catch (err) {
              console.error('Failed to import dropped file', err);
              // P1 FIX: if addMedia failed, probeFile's object URL still pins the
              // whole file blob in memory — revoke it.
              if (mediaItem?.url && mediaItem.url.startsWith('blob:')) {
                try { URL.revokeObjectURL(mediaItem.url); } catch { /* noop */ }
              }
              toast.error(`Failed to import ${file.name}`);
            }
          }
          setHoveredTrackId(null);
          setDropPreview(null);
        })();
        return;
      }

      // ── Media Item Drop ──
      const mediaId = e.dataTransfer.getData('application/procut-media');
      if (!mediaId) {
        // P3 FIX: clear the stale ghost/highlight on this early return
        setHoveredTrackId(null);
        setDropPreview(null);
        return;
      }

      const media = useEditorStore.getState().mediaLibrary.find((m) => m.id === mediaId);
      if (!media) {
        setHoveredTrackId(null);
        setDropPreview(null);
        return;
      }

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const startTime = Math.max(0, x / zoomLevel);

      const isText = media.type === 'text';
      const newClip: TimelineClip = {
        id: generateId(),
        mediaId,
        // P3 FIX: use the resolved track (container-level drops used to pass
        // trackId:'' and auto-append to the first valid track)
        trackId: track?.id || trackId,
        startTime,
        duration: isText ? 3 : (media.type === 'image' ? 5 : media.duration),
        trimStart: 0,
        trimEnd: 0,
        transform: { x: 0, y: isText ? 140 : 0, scale: 100, rotation: 0 },
        opacity: 1,
        speed: 1,
        effects: [],
        zIndex: isText ? 9999 : undefined,
        textSettings: isText ? {
          text: media.textContent || 'Text',
          fontSize: 26,
          fontFamily: 'Inter',
          color: '#ffffff',
          strokeWidth: 4,
          strokeColor: '#000000',
          bold: true,
          shadow: true,
          textAlign: 'center' as 'left' | 'center' | 'right',
          backgroundColor: 'transparent',
          italic: false,
          underline: false
        } : undefined
      };

      useEditorStore.getState().addClip(newClip);
      setHoveredTrackId(null);
      setDropPreview(null);
    },
    [zoomLevel, setHoveredTrackId, setDropPreview],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, trackId: string) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const state = useEditorStore.getState();
      let trackIdx = tracks.findIndex((t) => t.id === trackId);
      if (trackIdx === -1 && state.pipWindows) {
        for (const pip of Object.values(state.pipWindows)) {
          if (!pip) continue;
          const idx = pip.tracks.findIndex(t => t.id === trackId);
          if (idx !== -1) {
            trackIdx = idx;
            break;
          }
        }
      }

      const hasMedia = e.dataTransfer.types.includes('application/procut-media');
      const hasEffect = e.dataTransfer.types.includes('application/procut-effect');
      const hasCustomFx = e.dataTransfer.types.includes('application/procut-custom-fx');
      const hasColorPreset = e.dataTransfer.types.includes('application/procut-color-preset');
      const hasParticle = e.dataTransfer.types.includes('application/procut-particle');
      const hasTransition = e.dataTransfer.types.includes('application/procut-transition');
      const hasTemplate = e.dataTransfer.types.includes('application/procut-template');
      const hasFiles = e.dataTransfer.types.includes('Files');

      if ((hasMedia || hasEffect || hasCustomFx || hasColorPreset || hasParticle || hasTransition || hasTemplate || hasFiles) && (trackIdx >= 0 || hasMedia || hasFiles || hasTemplate || hasEffect || hasCustomFx)) {
        const dropTime = Math.max(0, x / zoomLevel);

        let approxDuration = 5;
        let mediaId: string | undefined;
        let mediaType: string | undefined;
        let mediaName: string | undefined;

        if (hasMedia) {
          // During dragover, dataTransfer.getData() returns '' in most browsers for security.
          // We use window.__procutDraggingMediaId set on drag start by MediaPanel.
          const draggingId = (window as any).__procutDraggingMediaId as string | undefined;
          if (draggingId) {
            const m = useEditorStore.getState().mediaLibrary.find(mi => mi.id === draggingId);
            if (m) {
              mediaId = m.id;
              mediaType = m.type;
              mediaName = m.name;
              approxDuration = m.type === 'image' ? 5 : m.duration;
            }
          }
        } else if (hasFiles) {
          mediaType = 'file';
          mediaName = 'Drop file(s)';
          approxDuration = 5;
        } else if (hasEffect || hasCustomFx) {
          mediaType = 'fx';
          mediaName = hasCustomFx ? 'Custom AI FX' : 'VFX Effect';
          approxDuration = 5;
        } else if (hasTemplate) {
          mediaType = 'text';
          mediaName = 'Title Template';
          approxDuration = 5;
        } else if (hasColorPreset || hasParticle || hasTransition) {
          approxDuration = 0;
        }

        setDropPreview({ time: dropTime, duration: approxDuration, trackIdx, mediaId, mediaType, mediaName });
        setHoveredTrackId(trackId);      }
    },
    [tracks, zoomLevel, setDropPreview, setHoveredTrackId],
  );

  return {
    handleDrop,
    handleDragOver,
  };
}
