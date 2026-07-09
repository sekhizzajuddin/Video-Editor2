import { useCallback } from 'react';
import { useEditorStore } from '@/store/editorStore';
import type { TimelineClip, OverLayerClip, ParticleEffectType, ClipParticleSettings } from '@/types';
import { TITLE_TEMPLATES } from '@/utils/titleTemplates';
import { generateId } from '../timelineUtils';
import { DEFAULT_TRACK_HEIGHT, THIN_TRACK_HEIGHT, OVER_LAYER_ROW_HEIGHT } from '../timelineConstants';
import type { TimelineState } from './useTimelineState';

interface UseTimelineDropDeps {
  timelineState: TimelineState;
}

export function useTimelineDrop({ timelineState }: UseTimelineDropDeps) {
  const {
    tracks,
    zoomLevel,
    hoveredOverLayerRegion,
    pinnedOverLayerTrackId,
    setHoveredOverLayerRegion,
    setPinnedOverLayerTrackId,
  } = useEditorStore();

  const {
    setHoveredTrackId,
    setDropPreview,
  } = timelineState;

  const handleDrop = useCallback(
    (e: React.DragEvent, trackId: string) => {
      e.preventDefault();
      // Clear the dragging media tracker set in MediaPanel's onDragStart
      (window as any).__procutDraggingMediaId = undefined;
      const track = useEditorStore.getState().tracks.find((t) => t.id === trackId);
      if (!track) return;

      // ── Transition drop → apply to video/image clip at drop position ──
      const transitionName = e.dataTransfer.getData('application/procut-transition');
      if (transitionName && track && track.type === 'video') {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const dropTime = x / zoomLevel;
        // Find the clip at the drop position
        const hitClip = track.clips.find(
          (c) => dropTime >= c.startTime && dropTime < c.startTime + c.duration
        );
        if (hitClip) {
          const type = transitionName.toLowerCase().includes('dissolve') ? 'dissolve'
                     : transitionName.toLowerCase().includes('wipe') ? 'wipe'
                     : transitionName.toLowerCase().includes('zoom') ? 'zoom'
                     : transitionName.toLowerCase().includes('slide') ? 'slide'
                     : 'dissolve';
          useEditorStore.getState().updateClip(hitClip.id, {
            transitionIn: {
              id: Math.random().toString(36).substr(2, 9),
              name: transitionName,
              type: type as any,
              duration: 1.0,
              params: {},
            },
          });
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
          const dropTime = x / zoomLevel;
          
          const baseHeight = DEFAULT_TRACK_HEIGHT;
          const isOverLayerArea = y > baseHeight;
          let targetOl: OverLayerClip | null = null;
          if (isOverLayerArea && hoveredOverLayerRegion && hoveredOverLayerRegion.trackId === trackId) {
            const activeOverLayers = (track.overLayers || []).filter((ol) => {
              return ol.startTime < hoveredOverLayerRegion.endTime && ol.startTime + ol.duration > hoveredOverLayerRegion.startTime;
            });
            const rowIdx = Math.floor((y - baseHeight) / OVER_LAYER_ROW_HEIGHT);
            targetOl = activeOverLayers[rowIdx] || null;
          }

          if (targetOl) {
            const existing = targetOl.colorFilters ?? {
              temperature: 0, tint: 0, exposure: 0, contrast: 100,
              saturation: 100, blur: 0, fadedFilm: 0, vignette: 0,
            };
            useEditorStore.getState().updateOverLayer(targetOl.id, {
              colorFilters: { ...existing, ...preset },
            });
            useEditorStore.getState().saveSnapshot();
          } else {
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
        const y = e.clientY - rect.top;
        const dropTime = x / zoomLevel;

        const baseHeight = DEFAULT_TRACK_HEIGHT;
        const isOverLayerArea = y > baseHeight;
        let targetOl: OverLayerClip | null = null;
        if (isOverLayerArea && hoveredOverLayerRegion && hoveredOverLayerRegion.trackId === trackId) {
          const activeOverLayers = (track.overLayers || []).filter((ol) => {
            return ol.startTime < hoveredOverLayerRegion.endTime && ol.startTime + ol.duration > hoveredOverLayerRegion.startTime;
          });
          const rowIdx = Math.floor((y - baseHeight) / OVER_LAYER_ROW_HEIGHT);
          targetOl = activeOverLayers[rowIdx] || null;
        }

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

        if (targetOl) {
          useEditorStore.getState().updateOverLayer(targetOl.id, {
            particleSettings: {
              type: particleType as ParticleEffectType,
              emitterX: 50,
              emitterY: 100,
              ...defaults,
            },
          });
          useEditorStore.getState().selectOverLayer(targetOl.id);
          useEditorStore.getState().saveSnapshot();
        } else {
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
        }
        setHoveredTrackId(null);
        setDropPreview(null);
        return;
      }

      // ── Animated Title Template drop ──
      const templateId = e.dataTransfer.getData('application/procut-template');
      if (templateId) {
        const tmpl = TITLE_TEMPLATES.find((t) => t.id === templateId);
        if (tmpl && track) {
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
        setHoveredTrackId(null);
        setDropPreview(null);
        return;
      }

      // ── VFX Effect Drop ──
      const effectName = e.dataTransfer.getData('application/procut-effect');
      if (effectName && track?.type === 'fx') {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const startTime = Math.max(0, x / zoomLevel);

        const FX_TYPE_MAP: Record<string, string> = {
          'VFX Breakdown':     'vfx_breakdown',
          'B&W to Color':      'bw_to_color',
          'Glitch':            'glitch',
          'Old Film':          'old_film',
          'VHS':               'vhs',
          'Cinematic Bars':    'cinematic_bars',
          'Neon Glow':         'neon_glow',
          'RGB Split':         'rgb_split',
          'Pixelate':          'pixelate',
          'Mirror':            'mirror',
          'Zoom Blur':         'zoom_blur',
          'Lens Flare':        'lens_flare',
          'Night Vision':      'night_vision',
          'Thermal':           'thermal',
        };
        const fxType = FX_TYPE_MAP[effectName] ?? effectName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const fxMediaId = generateId();
        useEditorStore.getState().addMedia({
          id: fxMediaId,
          name: effectName,
          type: 'fx',
          duration: 5,
          url: '',
          createdAt: Date.now(),
          fxType,
        });
        const fxClip: TimelineClip = {
          id: generateId(),
          mediaId: fxMediaId,
          trackId,
          startTime,
          duration: 5,
          trimStart: 0,
          trimEnd: 0,
          transform: { x: 0, y: 0, scale: 100, rotation: 0 },
          opacity: 1,
          speed: 1,
          effects: [],
          fxSettings: {
            type: fxType as any,
            intensity: 100,
          },
        };
        useEditorStore.getState().addClip(fxClip);
        setHoveredTrackId(null);
        setDropPreview(null);
        return;
      }

      // ── Media Item Drop ──
      const mediaId = e.dataTransfer.getData('application/procut-media');
      if (!mediaId) return;

      const media = useEditorStore.getState().mediaLibrary.find((m) => m.id === mediaId);
      if (!media) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const startTime = Math.max(0, x / zoomLevel);

      const baseHeight = track.type === 'text' || track.type === 'fx' ? THIN_TRACK_HEIGHT : DEFAULT_TRACK_HEIGHT;
      const isOverLayerArea = y > baseHeight;

      if (isOverLayerArea && hoveredOverLayerRegion && hoveredOverLayerRegion.trackId === trackId) {
        const activeOverLayers = (track.overLayers || []).filter((ol) => {
          return ol.startTime < hoveredOverLayerRegion.endTime && ol.startTime + ol.duration > hoveredOverLayerRegion.startTime;
        });
        
        const rowIdx = Math.floor((y - baseHeight) / OVER_LAYER_ROW_HEIGHT);
        const targetOl = activeOverLayers[rowIdx];
        
        if (targetOl) {
          let compatible = false;
          if (track.type === 'video' && (media.type === 'video' || media.type === 'image')) compatible = true;
          if (track.type === 'audio' && media.type === 'audio') compatible = true;
          if (track.type === 'text' && media.type === 'text') compatible = true;
          if (track.type === 'fx' && media.type === 'fx') compatible = true;
          
          if (compatible) {
            useEditorStore.getState().updateOverLayer(targetOl.id, {
              mediaId,
              duration: media.type === 'image' ? 5 : Math.min(10, media.duration),
              audioSettings: media.type === 'audio' || media.type === 'video' ? {
                volume: 0,
                pan: 0,
                fadeIn: 0,
                fadeOut: 0,
                bass: 0,
                treble: 0,
                muted: false,
                preservePitch: true,
                pitch: 0,
                voiceFormant: 0,
                humanize: false,
              } : undefined,
            });
            useEditorStore.getState().saveSnapshot();
          }
          setHoveredTrackId(null);
          setDropPreview(null);
          return;
        }
      }

      const newClip: TimelineClip = {
        id: generateId(),
        mediaId,
        trackId,
        startTime,
        duration: media.type === 'image' ? 5 : Math.min(10, media.duration),
        trimStart: 0,
        trimEnd: 0,
        transform: { x: 0, y: 0, scale: 100, rotation: 0 },
        opacity: 1,
        speed: 1,
        effects: [],
      };

      useEditorStore.getState().addClip(newClip);
      setHoveredTrackId(null);
      setDropPreview(null);
    },
    [zoomLevel, hoveredOverLayerRegion, setHoveredTrackId, setDropPreview],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, trackId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const trackIdx = tracks.findIndex((t) => t.id === trackId);

      const hasMedia = e.dataTransfer.types.includes('application/procut-media');
      const hasEffect = e.dataTransfer.types.includes('application/procut-effect');
      const hasColorPreset = e.dataTransfer.types.includes('application/procut-color-preset');
      const hasParticle = e.dataTransfer.types.includes('application/procut-particle');
      const hasTransition = e.dataTransfer.types.includes('application/procut-transition');
      const hasTemplate = e.dataTransfer.types.includes('application/procut-template');
      
      if ((hasMedia || hasEffect || hasColorPreset || hasParticle || hasTransition || hasTemplate) && trackIdx >= 0) {
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
              approxDuration = m.type === 'image' ? 5 : Math.min(10, m.duration);
            }
          }
        } else if (hasEffect) {
          mediaType = 'fx';
          mediaName = 'VFX Effect';
          approxDuration = 5;
        } else if (hasTemplate) {
          mediaType = 'text';
          mediaName = 'Title Template';
          approxDuration = 5;
        } else if (hasColorPreset || hasParticle || hasTransition) {
          approxDuration = 0;
        }

        setDropPreview({ time: dropTime, duration: approxDuration, trackIdx, mediaId, mediaType, mediaName });
        setHoveredTrackId(trackId);

        const track = tracks[trackIdx];
        if (track && (track.overLayers || []).length > 0) {
          const time = dropTime;
          const matchingOl = track.overLayers.find((ol) => {
            return time >= ol.startTime && time < ol.startTime + ol.duration;
          });
          if (matchingOl) {
            setHoveredOverLayerRegion({
              trackId,
              startTime: matchingOl.startTime,
              endTime: matchingOl.startTime + matchingOl.duration,
            });
          } else if (hoveredOverLayerRegion && hoveredOverLayerRegion.trackId === trackId) {
            setHoveredOverLayerRegion(null);
          }
        }
      }
    },
    [tracks, zoomLevel, hoveredOverLayerRegion, setDropPreview, setHoveredTrackId, setHoveredOverLayerRegion],
  );

  return {
    handleDrop,
    handleDragOver,
  };
}
