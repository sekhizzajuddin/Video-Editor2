/**
 * PreviewCanvasOverlay.tsx
 * 
 * Interactive SVG/HTML canvas overlay component for Preview Canvas.
 * Provides bounding boxes, corner scale handles, rotation handles, perspective pin controls,
 * mask editing handles, smart AI image selection (magic wand, lasso, polygon), inpainting,
 * and smart snapping guide lines.
 * 
 * Connected to:
 * - PropertyPanel: Live updating clip transform (x, y, scale, rotation), crop, mask & perspective corner parameters.
 * - Timeline: Evaluates animated keyframe values at the active currentTime.
 * - MediaPanel: Reads clip media items (images/videos) to derive natural dimensions.
 * - EditorStore: Reads & updates selectedClipId, tracks, pipWindows, activePropertiesTab, and transform modes.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Maximize2,
  Scissors,
  Wand2,
  Eraser,
  Sparkles,
  Ban,
} from 'lucide-react';
import { useEditorStore, findClipDeep } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import { getAnimatedValue, addOrUpdateKeyframe } from '@/utils/keyframes';
import { getCachedImage, LocalCornerPoints } from '@/utils/canvasEffects';
import { saveFileToDB } from '@/utils/projectPersistence';
import { removeBackground } from '@imgly/background-removal';
import { toast } from 'sonner';
import { getClipDimensions, inpaint, getOverlayMapping, clientToOverlay, clientToViewportSpace } from './previewMath';
import { usePlaybackTime } from '@/hooks/usePlaybackTime';
import { isKineticMediaId, getSentenceBounds } from '@/utils/kineticSync';
import { encodeMaskRle } from '@/utils/motionMask';
import {
  getFrameSize,
  getFrameOffset,
  quadToRect,
  rectToQuad,
  normalizeRegionToFrame,
} from '@/utils/frameSpace';

interface InteractiveCanvasOverlayProps {
  viewport: { x: number; y: number; zoom: number };
  videoElements: Map<string, HTMLVideoElement>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function PreviewCanvasOverlay({
  viewport,
  videoElements,
  containerRef
}: InteractiveCanvasOverlayProps) {
  // PERF: the overlay only draws selection/transform handles, so it does not need
  // a 60 Hz time signal — following the animated transform at 15 Hz is visually
  // indistinguishable. Selecting raw `currentTime` re-rendered this ~2k-line
  // component on every playback store write, competing with canvas compositing.
  // Drag handlers below read the exact time from the store when they need it.
  const currentTime = usePlaybackTime(15);
  const selectedClipId = useEditorStore(s => s.selectedClipId);
  const canvasTransformMode = useEditorStore(s => s.canvasTransformMode);
  const setCanvasTransformMode = useEditorStore(s => s.setCanvasTransformMode);
  const aspectRatio = useEditorStore(s => s.aspectRatio);
  const perRatioFraming = useEditorStore(s => s.perRatioFraming);
  const perRatioFramingEnabled = useEditorStore(s => s.perRatioFramingEnabled);
  const useProxies = useEditorStore(s => s.useProxies);
  const activePropertiesTab = useEditorStore(s => s.activePropertiesTab);
  const storeUpdateClip = useEditorStore(s => s.updateClip);
  const virtualCamera = useEditorStore(s => s.virtualCamera);
  const addOrUpdateVirtualCameraKeyframe = useEditorStore(s => s.addOrUpdateVirtualCameraKeyframe);

  const { tracks, pipWindows, mediaLibrary } = useEditorStore(useShallow(s => ({
    tracks: s.tracks,
    pipWindows: s.pipWindows,
    mediaLibrary: s.mediaLibrary,
  })));

  const updateClip = useCallback((clipId: string, updates: any) => {
    storeUpdateClip(clipId, updates);
  }, [storeUpdateClip]);

  const [dragState, setDragState] = useState<{
    type: string;
    startX: number;
    startY: number;
    initTransform: any;
    initCrop: any;
    baseW?: number;
    baseH?: number;
    initCorners?: LocalCornerPoints;
    /**
     * Distance from the clip centre to the POINTER at mousedown, in clip-local
     * units. Corner resize is driven by the ratio of the current pointer distance
     * to this, so the exact spot you grab inside the handle no longer matters.
     */
    initPointerDist?: number;
    /** Per-axis |pointer - centre| at mousedown, for the Shift aspect lock. */
    initPointerDx?: number;
    initPointerDy?: number;
    /** Pointer angle (deg) about the clip centre at mousedown, for rotation. */
    initPointerAngle?: number;
    initMask?: any;
    initVirtualCamera?: { x: number; y: number };
  } | null>(null);
  
  const [snapGuides, setSnapGuides] = useState<{axis: 'x'|'y', position: number}[]>([]);

  /**
   * Drag state for the motion-tracked REGION boxes (FX tab).
   *
   * Deliberately separate from `dragState`: a motion region is authored in
   * absolute 854x480 frame space so it can sit over any part of the picture,
   * whereas `dragState` operates in clip-local space and is affected by the
   * clip's own transform.
   */
  /**
   * Paint-brush stroke being drawn for a motion region, in 854x480 frame space.
   * Kept as a point list while drawing and rasterised on mouse-up.
   */
  const [paintStroke, setPaintStroke] = useState<{
    index: number;
    points: Array<{ x: number; y: number }>;
  } | null>(null);

  /**
   * Which motion region is currently armed for painting, or null.
   * Set from the FX panel's "Paint Region" button via a global event, so the
   * panel and overlay stay decoupled.
   */
  const [paintArmedIndex, setPaintArmedIndex] = useState<number | null>(null);

  /**
   * Which region is currently being EDITED (box handles or brush), or null.
   *
   * While editing, the clip's own transform box is hidden and its handles are
   * disabled. Without this the two overlays sit on top of each other: a drag
   * intended to move the region box instead grabs the clip and repositions the
   * whole shot, which makes the region impossible to place.
   */
  const [editingRegionIndex, setEditingRegionIndex] = useState<number | null>(null);

  useEffect(() => {
    const onEdit = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setEditingRegionIndex(
        detail && typeof detail.index === 'number' && detail.clipId === selectedClipId
          ? detail.index
          : null
      );
    };
    window.addEventListener('procut-motion-region-edit', onEdit);
    return () => window.removeEventListener('procut-motion-region-edit', onEdit);
  }, [selectedClipId]);

  useEffect(() => { setEditingRegionIndex(null); }, [selectedClipId]);

  useEffect(() => {
    const onArm = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setPaintArmedIndex(
        detail && typeof detail.index === 'number' && detail.clipId === selectedClipId
          ? detail.index
          : null
      );
    };
    window.addEventListener('procut-motion-paint-arm', onArm);
    return () => window.removeEventListener('procut-motion-paint-arm', onArm);
  }, [selectedClipId]);

  // Disarm when the selection changes, so a stray click on another clip cannot
  // paint into the wrong region.
  useEffect(() => { setPaintArmedIndex(null); }, [selectedClipId]);

  const [regionDrag, setRegionDrag] = useState<{
    index: number;
    mode: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'new';
    startX: number;
    startY: number;
    init: { cx: number; cy: number; w: number; h: number };
  } | null>(null);

  /**
   * Live brush position in FRAME space, for the Photoshop-style brush ring.
   * Null when the pointer is outside the picture.
   */
  const [brushCursor, setBrushCursor] = useState<{ x: number; y: number } | null>(null);

  const [imageEditorTool, setImageEditorTool] = useState<'none' | 'magic' | 'lasso' | 'poly'>('none');
  const [selectionPath, setSelectionPath] = useState<{ x: number; y: number }[]>([]);
  const [selectionMask, setSelectionMask] = useState<Uint8ClampedArray | null>(null);
  const [isProcessingSelection, setIsProcessingSelection] = useState(false);
  const editedBlobUrlRef = useRef<string | null>(null);
  const isDrawingRef = useRef(false);

  let activeClip: any = null;
  let mediaItem: any = null;

  if (selectedClipId) {
    let found = false;
    for (const track of tracks) {
      if (track.hidden) continue;
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip && currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
        activeClip = clip;
        mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId) ||
          (clip.textSettings || clip.mediaId === 'text-placeholder'
            ? { id: clip.mediaId, name: 'Text', type: 'text', duration: clip.duration, url: '', createdAt: Date.now() }
            : null);
        found = true;
        break;
      }
    }
    
    // Also search inside PIP windows
    if (!found && pipWindows) {
      for (const [pipId, pip] of Object.entries(pipWindows)) {
        let parentClip = null;
        for (const t of tracks) {
          parentClip = t.clips.find(c => c.id === (pip as any).parentClipId);
          if (parentClip) break;
        }
        
        if (!parentClip) continue;
        const pipAbsStart = parentClip.startTime + (pip.relativeStartTime || 0);
        
        if (currentTime >= pipAbsStart && currentTime < pipAbsStart + pip.duration) {
          for (const track of pip.tracks) {
            const clip = track.clips.find((c) => c.id === selectedClipId);
            if (clip) {
              const ptAbsStart = pipAbsStart + clip.startTime;
              if (currentTime >= ptAbsStart && currentTime < ptAbsStart + clip.duration) {
                activeClip = clip;
                mediaItem = mediaLibrary.find((m) => m.id === clip.mediaId) || null;
                found = true;
                break;
              }
            }
          }
        }
        if (found) break;
      }
    }
  }

  // Absolute timeline start of the selected clip.
  //
  // CRITICAL for PiP children (kinetic word layers): a PiP clip's `startTime` is
  // RELATIVE to its PiP window, while `currentTime` is absolute. Evaluating
  // keyframes with the relative value samples the animation at completely the
  // wrong local time. Kinetic words carry a "pop" keyframe on transform.scale
  // (135% -> 100% over 0.12s), so the overlay could read 135% while the drag
  // handler — which already resolved the ABSOLUTE start — read 100%. The box was
  // therefore drawn ~35% too large, and the first mousemove wrote the real value,
  // making it snap smaller. The same disagreement on transform.x/y made the clip
  // jump before it started following the pointer.
  const activeClipAbsStartTime = React.useMemo(() => {
    if (!activeClip) return 0;
    const state = useEditorStore.getState();
    const found = findClipDeep(state, activeClip.id);
    if (found?.isPip && found.pipId) {
      const pip = (state.pipWindows || {})[found.pipId];
      if (pip) {
        for (const t of state.tracks) {
          const parent = t.clips.find((c) => c.id === pip.parentClipId);
          if (parent) return parent.startTime + (pip.relativeStartTime || 0) + found.clip.startTime;
        }
      }
    }
    return activeClip.startTime;
  }, [activeClip, tracks, pipWindows]);

  let aX = activeClip ? getAnimatedValue(activeClip.transform.x, currentTime, activeClipAbsStartTime, activeClip.animations?.['transform.x']) : 0;
  let aY = activeClip ? getAnimatedValue(activeClip.transform.y, currentTime, activeClipAbsStartTime, activeClip.animations?.['transform.y']) : 0;
  let aScale = activeClip ? getAnimatedValue(activeClip.transform.scale, currentTime, activeClipAbsStartTime, activeClip.animations?.['transform.scale']) : 100;
  const aRot = activeClip ? getAnimatedValue(activeClip.transform.rotation, currentTime, activeClipAbsStartTime, activeClip.animations?.['transform.rotation']) : 0;

  if (activeClip && perRatioFramingEnabled && perRatioFraming[aspectRatio]?.[activeClip.id]) {
    const customFraming = perRatioFraming[aspectRatio][activeClip.id];
    if (customFraming.x !== undefined) aX += customFraming.x;
    if (customFraming.y !== undefined) aY += customFraming.y;
    if (customFraming.scale !== undefined) aScale *= (customFraming.scale / 100);
  }

  const aCropLeft = activeClip ? getAnimatedValue(activeClip.crop?.left || 0, currentTime, activeClipAbsStartTime, activeClip.animations?.['crop.left']) : 0;
  const aCropTop = activeClip ? getAnimatedValue(activeClip.crop?.top || 0, currentTime, activeClipAbsStartTime, activeClip.animations?.['crop.top']) : 0;
  const aCropRight = activeClip ? getAnimatedValue(activeClip.crop?.right || 0, currentTime, activeClipAbsStartTime, activeClip.animations?.['crop.right']) : 0;
  const aCropBot = activeClip ? getAnimatedValue(activeClip.crop?.bottom || 0, currentTime, activeClipAbsStartTime, activeClip.animations?.['crop.bottom']) : 0;

  const getHeartPathData = (x: number, y: number, w: number, h: number): string => {
    return `M 0,${h * 0.15} 
            C 0,${-h * 0.35} ${-w * 0.5},${-h * 0.35} ${-w * 0.5},${h * 0.15}
            C ${-w * 0.5},${h * 0.4} 0,${h * 0.45} 0,${h * 0.45}
            C 0,${h * 0.45} ${w * 0.5},${h * 0.4} ${w * 0.5},${h * 0.15}
            C ${w * 0.5},${-h * 0.35} 0,${-h * 0.35} 0,${h * 0.15} Z`;
  };

  const getStarPointsData = (cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number): string => {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;
    const pts = [];

    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      rot += step;
    }
    return pts.join(' ');
  };

  useEffect(() => {
    if (!dragState || !activeClip) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const container = document.getElementById('preview-canvas-wrapper');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const { scale: overlayScale } = getOverlayMapping(rect);

      const clientX = 'touches' in e && e.touches[0] ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e && e.touches[0] ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const dx = ((clientX - dragState.startX) * overlayScale) / viewport.zoom;
      const dy = ((clientY - dragState.startY) * overlayScale) / viewport.zoom;

      let x = 0, y = 0, scale = 100, rotation = 0;
      if (dragState.initTransform) {
        x = dragState.initTransform.x;
        y = dragState.initTransform.y;
        scale = dragState.initTransform.scale;
        rotation = dragState.initTransform.rotation;
      }
      const crop = dragState.initCrop ? { ...dragState.initCrop } : { left: 0, top: 0, right: 0, bottom: 0 };
      
      const baseW = dragState.baseW || 854;
      const baseH = dragState.baseH || 480;

      let animations = activeClip.animations || {};
      const getActiveClipAbsoluteStartTime = (clipId: string): number => {
        const state = useEditorStore.getState();
        const found = findClipDeep(state, clipId);
        if (found && found.isPip && found.pipId) {
          const pip = (state.pipWindows || {})[found.pipId];
          if (pip) {
            let parentClip = null;
            for (const t of state.tracks) {
              parentClip = t.clips.find(c => c.id === pip.parentClipId);
              if (parentClip) break;
            }
            if (parentClip) {
              return parentClip.startTime + (pip.relativeStartTime || 0) + found.clip.startTime;
            }
          }
        }
        return found?.clip.startTime ?? 0;
      };
      const activeClipAbsStart = getActiveClipAbsoluteStartTime(activeClip.id);
      const localTime = currentTime - activeClipAbsStart;

      const getNewAnimations = (prop: string, val: number) => {
        if (animations[prop]) {
          animations = { ...animations, [prop]: addOrUpdateKeyframe(animations[prop], localTime, val) };
        }
      };

      /**
       * Scale an ENTIRE keyframe track by a ratio, preserving its shape.
       *
       * Kinetic word clips ship with a "pop" on transform.scale (135% -> 100%).
       * Because that track exists, the animated value — not `transform.scale` —
       * is what renders. Resizing wrote the new size into the base only, so the
       * keyframes kept forcing 100% and the resize appeared to work but was
       * discarded the moment anything else touched the clip.
       *
       * Multiplying every keyframe by the same ratio keeps the animation's
       * character (the pop still overshoots by 35%) while honouring the new size.
       */
      const scaleAnimationTrack = (prop: string, ratio: number) => {
        const track = animations[prop];
        if (!track?.length || !Number.isFinite(ratio) || ratio <= 0) return;
        animations = {
          ...animations,
          [prop]: track.map((k: any) => ({ ...k, value: k.value * ratio })),
        };
      };

      if (dragState.type.startsWith('perspective-corner-')) {
        const cornerIdx = parseInt(dragState.type.split('-')[2]);
        const initCorners = dragState.initCorners!;
        const updatedCorners = { ...initCorners };

        const targetKeyX = `x${cornerIdx}` as keyof typeof initCorners;
        const targetKeyY = `y${cornerIdx}` as keyof typeof initCorners;

        let deltaX = dx;
        let deltaY = dy;
        
        if (activeClip.transform.perspectivePin) {
          const invScale = 100 / aScale;
          deltaX *= invScale;
          deltaY *= invScale;
          
          const invRot = (-aRot * Math.PI) / 180;
          const cos = Math.cos(invRot);
          const sin = Math.sin(invRot);
          
          const rotDx = deltaX * cos - deltaY * sin;
          const rotDy = deltaX * sin + deltaY * cos;
          
          deltaX = rotDx;
          deltaY = rotDy;
        }

        updatedCorners[targetKeyX] = initCorners[targetKeyX] + deltaX;
        updatedCorners[targetKeyY] = initCorners[targetKeyY] + deltaY;

        const hasKeyframes =
          (animations[`transform.perspectiveCorners.x0`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.y0`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.x1`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.y1`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.x2`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.y2`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.x3`]?.length || 0) > 0 ||
          (animations[`transform.perspectiveCorners.y3`]?.length || 0) > 0;

        if (hasKeyframes) {
          const newAnimations = { ...animations };
          for (let i = 0; i < 4; i++) {
            const kx = `transform.perspectiveCorners.x${i}`;
            const ky = `transform.perspectiveCorners.y${i}`;
            const valX = updatedCorners[`x${i}` as keyof typeof updatedCorners];
            const valY = updatedCorners[`y${i}` as keyof typeof updatedCorners];

            newAnimations[kx] = addOrUpdateKeyframe(animations[kx] || [], localTime, valX);
            newAnimations[ky] = addOrUpdateKeyframe(animations[ky] || [], localTime, valY);
          }
          updateClip(activeClip.id, {
            transform: {
              ...activeClip.transform,
              perspectiveCorners: updatedCorners
            },
            animations: newAnimations
          });
        } else {
          updateClip(activeClip.id, {
            transform: {
              ...activeClip.transform,
              perspectiveCorners: updatedCorners
            }
          });
        }
        return;
      }

      if (dragState.type.startsWith('mask-')) {
        const initM = (dragState as any).initMask || { x: 50, y: 50, width: 50, height: 50, rotation: 0, feather: 0, roundness: 0 };
        let mx = initM.x;
        let my = initM.y;
        let mw = initM.width;
        let mh = initM.height;
        let mRot = initM.rotation;
        let mFeather = initM.feather;
        let mRoundness = initM.roundness;

        const baseW = dragState.baseW || 854;
        const baseH = dragState.baseH || 480;

        if (dragState.type === 'mask-move') {
          const theta = (-aRot * Math.PI) / 180;
          const localDx = dx * Math.cos(theta) - dy * Math.sin(theta);
          const localDy = dx * Math.sin(theta) + dy * Math.cos(theta);

          mx = Math.max(0, Math.min(100, initM.x + (localDx / baseW) * 100));
          my = Math.max(0, Math.min(100, initM.y + (localDy / baseH) * 100));
          
          getNewAnimations('mask.x', mx);
          getNewAnimations('mask.y', my);
        } else if (dragState.type === 'mask-rot') {
          const container = document.getElementById('preview-canvas-wrapper');
          if (container) {
            const rect = container.getBoundingClientRect();
            const ptr = clientToViewportSpace(clientX, clientY, rect, viewport);
            const clientXLocal = ptr.x - (offsetX + W / 2 + aX);
            const clientYLocal = ptr.y - (offsetY + H / 2 + aY);
            
            const clipRotRad = (-aRot * Math.PI) / 180;
            const mxLocal = clientXLocal * Math.cos(clipRotRad) - clientYLocal * Math.sin(clipRotRad);
            const myLocal = clientXLocal * Math.sin(clipRotRad) + clientYLocal * Math.cos(clipRotRad);
            
            const maskCXLocal = -baseW / 2 + (mx / 100) * baseW;
            const maskCYLocal = -baseH / 2 + (my / 100) * baseH;
            
            const vx = mxLocal - maskCXLocal;
            const vy = myLocal - maskCYLocal;
            
            let angle = Math.atan2(vy, vx) * (180 / Math.PI);
            angle += 90;
            mRot = Math.round((angle + 360) % 360);
            
            getNewAnimations('mask.rotation', mRot);
          }
        } else if (dragState.type === 'mask-resize-r') {
          const container = document.getElementById('preview-canvas-wrapper');
          if (container) {
            const rect = container.getBoundingClientRect();
            const ptr = clientToViewportSpace(clientX, clientY, rect, viewport);
            const clientXLocal = ptr.x - (offsetX + W / 2 + aX);
            const clientYLocal = ptr.y - (offsetY + H / 2 + aY);
            
            const clipRotRad = (-aRot * Math.PI) / 180;
            const mxLocal = clientXLocal * Math.cos(clipRotRad) - clientYLocal * Math.sin(clipRotRad);
            const myLocal = clientXLocal * Math.sin(clipRotRad) + clientYLocal * Math.cos(clipRotRad);
            
            const maskCXLocal = -baseW / 2 + (mx / 100) * baseW;
            const maskCYLocal = -baseH / 2 + (my / 100) * baseH;
            
            const vx = mxLocal - maskCXLocal;
            const vy = myLocal - maskCYLocal;
            
            const maskRotRad = (mRot * Math.PI) / 180;
            const projX = vx * Math.cos(-maskRotRad) - vy * Math.sin(-maskRotRad);
            
            mw = Math.max(2, Math.min(200, (Math.abs(projX) * 2 / baseW) * 100));
            getNewAnimations('mask.width', mw);
          }
        } else if (dragState.type === 'mask-resize-b') {
          const container = document.getElementById('preview-canvas-wrapper');
          if (container) {
            const rect = container.getBoundingClientRect();
            const ptr = clientToViewportSpace(clientX, clientY, rect, viewport);
            const clientXLocal = ptr.x - (offsetX + W / 2 + aX);
            const clientYLocal = ptr.y - (offsetY + H / 2 + aY);
            
            const clipRotRad = (-aRot * Math.PI) / 180;
            const mxLocal = clientXLocal * Math.cos(clipRotRad) - clientYLocal * Math.sin(clipRotRad);
            const myLocal = clientXLocal * Math.sin(clipRotRad) + clientYLocal * Math.cos(clipRotRad);
            
            const maskCXLocal = -baseW / 2 + (mx / 100) * baseW;
            const maskCYLocal = -baseH / 2 + (my / 100) * baseH;
            
            const vx = mxLocal - maskCXLocal;
            const vy = myLocal - maskCYLocal;
            
            const maskRotRad = (mRot * Math.PI) / 180;
            const projY = vx * Math.sin(-maskRotRad) + vy * Math.cos(-maskRotRad);
            
            mh = Math.max(2, Math.min(200, (Math.abs(projY) * 2 / baseH) * 100));
            getNewAnimations('mask.height', mh);
          }
        } else if (dragState.type === 'mask-feather') {
          const container = document.getElementById('preview-canvas-wrapper');
          if (container) {
            const rect = container.getBoundingClientRect();
            const ptr = clientToViewportSpace(clientX, clientY, rect, viewport);
            const clientXLocal = ptr.x - (offsetX + W / 2 + aX);
            const clientYLocal = ptr.y - (offsetY + H / 2 + aY);
            
            const clipRotRad = (-aRot * Math.PI) / 180;
            const mxLocal = clientXLocal * Math.cos(clipRotRad) - clientYLocal * Math.sin(clipRotRad);
            const myLocal = clientXLocal * Math.sin(clipRotRad) + clientYLocal * Math.cos(clipRotRad);
            
            const maskCXLocal = -baseW / 2 + (mx / 100) * baseW;
            const maskCYLocal = -baseH / 2 + (my / 100) * baseH;
            
            const vx = mxLocal - maskCXLocal;
            const vy = myLocal - maskCYLocal;
            
            const maskRotRad = (mRot * Math.PI) / 180;
            const projX = vx * Math.cos(-maskRotRad) - vy * Math.sin(-maskRotRad);
            
            const maskLocalW = (mw / 100) * baseW;
            const minDim = Math.min(baseW, baseH);
            const distFromEdge = projX - maskLocalW / 2;
            mFeather = Math.max(0, Math.min(100, (distFromEdge / (minDim / 2)) * 100));
            getNewAnimations('mask.feather', mFeather);
          }
        } else if (dragState.type === 'mask-roundness') {
          const container = document.getElementById('preview-canvas-wrapper');
          if (container) {
            const rect = container.getBoundingClientRect();
            const ptr = clientToViewportSpace(clientX, clientY, rect, viewport);
            const clientXLocal = ptr.x - (offsetX + W / 2 + aX);
            const clientYLocal = ptr.y - (offsetY + H / 2 + aY);
            
            const clipRotRad = (-aRot * Math.PI) / 180;
            const mxLocal = clientXLocal * Math.cos(clipRotRad) - clientYLocal * Math.sin(clipRotRad);
            const myLocal = clientXLocal * Math.sin(clipRotRad) + clientYLocal * Math.cos(clipRotRad);
            
            const maskCXLocal = -baseW / 2 + (mx / 100) * baseW;
            const maskCYLocal = -baseH / 2 + (my / 100) * baseH;
            
            const vx = mxLocal - maskCXLocal;
            const vy = myLocal - maskCYLocal;
            
            const maskRotRad = (mRot * Math.PI) / 180;
            const projX = vx * Math.cos(-maskRotRad) - vy * Math.sin(-maskRotRad);
            
            const maskLocalW = (mw / 100) * baseW;
            const relativeOffset = (projX + maskLocalW / 2) / (maskLocalW / 2);
            mRoundness = Math.max(0, Math.min(100, relativeOffset * 100));
            getNewAnimations('mask.roundness', mRoundness);
          }
        }

        updateClip(activeClip.id, {
          mask: {
            ...activeClip.mask,
            x: mx,
            y: my,
            width: mw,
            height: mh,
            rotation: mRot,
            feather: mFeather,
            roundness: mRoundness,
          },
          animations
        });
        return;
      }
      
      if (dragState.type === 'virtualCamera') {
        const dx = (clientX - dragState.startX) / (viewport.zoom * 854);
        const dy = (clientY - dragState.startY) / (viewport.zoom * 480);
        const newX = dragState.initVirtualCamera!.x + dx;
        const newY = dragState.initVirtualCamera!.y + dy;
        addOrUpdateVirtualCameraKeyframe(currentTime, newX, newY);
        return;
      }

      if (dragState.type === 'move') {
        let newX = x + dx;
        let newY = y + dy;

        // Pixel snap: round to whole pixels by default, 0.5 with Shift, raw with Alt
        if (!e.altKey && !e.shiftKey) {
          newX = Math.round(newX);
          newY = Math.round(newY);
        } else if (e.shiftKey) {
          newX = Math.round(newX * 2) / 2;
          newY = Math.round(newY * 2) / 2;
        }

        const newGuides: { axis: 'x' | 'y'; position: number }[] = [];
        // Threshold in FRAME units, scaled to the project size and the zoom level.
        // A flat 12 was ~2.8% of a 16:9 frame's height but ~4.4% of a 9:16 frame's
        // width, and it did not shrink as the user zoomed in — so on vertical
        // projects the centre line grabbed the clip over a wide band and fine
        // positioning became a fight.
        const snapThreshold = Math.max(2, (Math.min(W, H) * 0.02) / (viewport.zoom || 1));

        const draggedWidth = (dragState.baseW || 854) * (scale / 100);
        const draggedHeight = (dragState.baseH || 480) * (scale / 100);

        const state = useEditorStore.getState();
        const otherActiveClips: any[] = [];
        state.tracks.forEach((track) => {
          if (track.hidden) return;
          track.clips.forEach((clip) => {
            if (clip.id === activeClip.id) return;
            if (currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration) {
              otherActiveClips.push(clip);
            }
          });
        });

        if (state.pipWindows) {
          Object.values(state.pipWindows).forEach((pip: any) => {
            let parentClip = null;
            for (const t of state.tracks) {
              parentClip = t.clips.find(c => c.id === pip.parentClipId);
              if (parentClip) break;
            }
            if (!parentClip) return;
            const pipAbsStart = parentClip.startTime + (pip.relativeStartTime || 0);
            if (currentTime >= pipAbsStart && currentTime < pipAbsStart + pip.duration) {
              pip.tracks.forEach((track: any) => {
                track.clips.forEach((clip: any) => {
                  if (clip.id === activeClip.id) return;
                  const ptAbsStart = pipAbsStart + clip.startTime;
                  if (currentTime >= ptAbsStart && currentTime < ptAbsStart + clip.duration) {
                    otherActiveClips.push(clip);
                  }
                });
              });
            }
          });
        }

        let bestSnapX: number | null = null;
        let minDiffX = Infinity;
        let snapXVal: number | null = null;

        // Use the ACTUAL frame size. These locals previously hard-coded 854x480,
        // shadowing the aspect-ratio-aware W/H computed for the rest of the
        // component, so on a 9:16 or 1:1 project every edge-snap target sat far
        // outside the real frame.
        const snapW = W;
        const snapH = H;

        // ── Alignment snapping ────────────────────────────────────────────────
        // Snapping must assist, never fight. Two rules keep it predictable:
        //
        //  a) Per-axis arming. The old check used the total distance from the drag
        //     origin, so once the pointer had travelled 4 units in ANY direction
        //     snapping stayed armed for the rest of the gesture — the clip then
        //     re-snapped on every frame and had to be yanked out of the band.
        //     Arming each axis on its own movement lets a purely vertical drag
        //     leave the horizontal guide alone, and vice versa.
        //
        //  b) Snap only when moving TOWARD the line. Pulling away from a guide must
        //     always release it. Without this, dragging down from just above a
        //     guide pushed the clip back UP onto it — the reported "moves the wrong
        //     way" behaviour.
        const snapArmedX = Math.abs(dx) > 2;
        const snapArmedY = Math.abs(dy) > 2;

        const targetsX = [
          -snapW / 2,
          0,
          snapW / 2
        ];

        otherActiveClips.forEach((other) => {
          const dims = getClipDimensions(other, mediaLibrary, snapW, snapH);
          const oX = other.transform?.x ?? 0;
          targetsX.push(oX - dims.width / 2);
          targetsX.push(oX);
          targetsX.push(oX + dims.width / 2);
        });

        const draggedAnchorsX = [
          { val: newX - draggedWidth / 2, type: 'left' },
          { val: newX, type: 'center' },
          { val: newX + draggedWidth / 2, type: 'right' }
        ];

        draggedAnchorsX.forEach((anchor) => {
          targetsX.forEach((targetVal) => {
            const diff = Math.abs(anchor.val - targetVal);
            if (diff >= snapThreshold || diff >= minDiffX) return;
            const candidate =
              anchor.type === 'left'
                ? targetVal + draggedWidth / 2
                : anchor.type === 'center'
                  ? targetVal
                  : targetVal - draggedWidth / 2;
            // Reject a snap whose CORRECTION would push the clip against the drag
            // direction. Otherwise a guide just behind the pointer drags the clip
            // backwards, which reads as "it moves the wrong way".
            const correction = candidate - newX;
            if (correction !== 0 && Math.sign(correction) === -Math.sign(dx)) return;
            minDiffX = diff;
            bestSnapX = candidate;
            snapXVal = targetVal;
          });
        });

        if (snapArmedX && bestSnapX !== null) {
          newX = bestSnapX;
          if (snapXVal !== null) {
            newGuides.push({ axis: 'x', position: snapXVal });
          }
        }

        let bestSnapY: number | null = null;
        let minDiffY = Infinity;
        let snapYVal: number | null = null;

        const targetsY = [
          -snapH / 2,
          0,
          snapH / 2
        ];

        otherActiveClips.forEach((other) => {
          const dims = getClipDimensions(other, mediaLibrary, snapW, snapH);
          const oY = other.transform?.y ?? 0;
          targetsY.push(oY - dims.height / 2);
          targetsY.push(oY);
          targetsY.push(oY + dims.height / 2);
        });

        const draggedAnchorsY = [
          { val: newY - draggedHeight / 2, type: 'top' },
          { val: newY, type: 'center' },
          { val: newY + draggedHeight / 2, type: 'bottom' }
        ];

        draggedAnchorsY.forEach((anchor) => {
          targetsY.forEach((targetVal) => {
            const diff = Math.abs(anchor.val - targetVal);
            if (diff >= snapThreshold || diff >= minDiffY) return;
            const candidate =
              anchor.type === 'top'
                ? targetVal + draggedHeight / 2
                : anchor.type === 'center'
                  ? targetVal
                  : targetVal - draggedHeight / 2;
            const correction = candidate - newY;
            if (correction !== 0 && Math.sign(correction) === -Math.sign(dy)) return;
            minDiffY = diff;
            bestSnapY = candidate;
            snapYVal = targetVal;
          });
        });

        if (snapArmedY && bestSnapY !== null) {
          newY = bestSnapY;
          if (snapYVal !== null) {
            newGuides.push({ axis: 'y', position: snapYVal });
          }
        }

        const uniqueGuides = newGuides.filter(
          (g, idx, self) => self.findIndex((o) => o.axis === g.axis && Math.abs(o.position - g.position) < 0.1) === idx
        );
        setSnapGuides(uniqueGuides);

        getNewAnimations('transform.x', newX);
        getNewAnimations('transform.y', newY);
        x = newX;
        y = newY;
      } else if (dragState.type.startsWith('crop-')) {
        // Anchor to drag-start rotation/scale (see edge-resize note): using the
        // live values changes the conversion factor mid-drag.
        const initRotCrop = dragState.initTransform.rotation || 0;
        const initScaleCrop = dragState.initTransform.scale || 100;
        const theta = (-initRotCrop * Math.PI) / 180;
        const localDx = (dx * Math.cos(theta) - dy * Math.sin(theta)) / (initScaleCrop / 100);
        const localDy = (dx * Math.sin(theta) + dy * Math.cos(theta)) / (initScaleCrop / 100);

        if (dragState.type === 'crop-left') {
          crop.left = Math.max(0, Math.min(100 - crop.right - 1, crop.left + (localDx / baseW) * 100));
          getNewAnimations('crop.left', crop.left);
        } else if (dragState.type === 'crop-right') {
          crop.right = Math.max(0, Math.min(100 - crop.left - 1, crop.right - (localDx / baseW) * 100));
          getNewAnimations('crop.right', crop.right);
        } else if (dragState.type === 'crop-top') {
          crop.top = Math.max(0, Math.min(100 - crop.bottom - 1, crop.top + (localDy / baseH) * 100));
          getNewAnimations('crop.top', crop.top);
        } else if (dragState.type === 'crop-bottom') {
          crop.bottom = Math.max(0, Math.min(100 - crop.top - 1, crop.bottom - (localDy / baseH) * 100));
          getNewAnimations('crop.bottom', crop.bottom);
        }
      } else if (dragState.type === 'rot') {
        // Centre in CLIP-LOCAL space: the handle group is drawn inside
        // translate(offsetX, offsetY) then translate(W/2 + aX, H/2 + aY).
        const cx = offsetX + W / 2 + x;
        const cy = offsetY + H / 2 + y;
        // Undo the viewport zoom/pan too, or the angle is measured in the wrong
        // space and the clip snaps the moment the handle is grabbed.
        const ptrAbs = clientToViewportSpace(clientX, clientY, rect, viewport);
        const mx = ptrAbs.x;
        const my = ptrAbs.y;
        // Rotate by the CHANGE in pointer angle since mousedown, applied to the
        // rotation the clip already had. Setting an absolute angle from the
        // pointer (the old `angle + 90`) assumed you grabbed the handle at exactly
        // 12 o'clock relative to the clip: any other grab point — or a clip that
        // was already rotated — snapped it to a new angle on the first mousemove.
        const pointerAngleNow = (Math.atan2(my - cy, mx - cx) * 180) / Math.PI;
        const grabAngle = dragState.initPointerAngle ?? pointerAngleNow;
        let angle = (dragState.initTransform.rotation || 0) + (pointerAngleNow - grabAngle);
        // CapCut-style rotation snap: Shift -> 15° increments, Alt -> 1° (fine), no modifier -> 0.5°
        if (e.shiftKey) {
          rotation = Math.round(angle / 15) * 15;
        } else if (e.altKey) {
          rotation = angle;
        } else {
          rotation = Math.round(angle * 2) / 2;
        }
        getNewAnimations('transform.rotation', rotation);
      } else if (
        dragState.type === 'resize-t' ||
        dragState.type === 'resize-b' ||
        dragState.type === 'resize-l' ||
        dragState.type === 'resize-r'
      ) {
        // Edge-resize: project delta onto the clip's local (un-rotated) frame and
        // adjust the uniform scale based on the dominant axis. Shift locks aspect.
        // Anchor the projection to the values at DRAG START. `scale` and `rotation`
        // are mutated during the drag, so using them makes the conversion factor
        // change under the user's hand — the clip accelerates or reverses as it
        // resizes. Deltas are measured from the start point, so the basis must be
        // the start basis too.
        const initRotEdge = dragState.initTransform.rotation || 0;
        const initScaleForProj = dragState.initTransform.scale || 100;
        const theta = (-initRotEdge * Math.PI) / 180;
        const invScale = 100 / initScaleForProj;
        const localDx = (dx * Math.cos(theta) - dy * Math.sin(theta)) * invScale;
        const localDy = (dx * Math.sin(theta) + dy * Math.cos(theta)) * invScale;

        let dxAxis = 0;
        let dyAxis = 0;
        if (dragState.type === 'resize-l') dxAxis = -localDx;
        if (dragState.type === 'resize-r') dxAxis = localDx;
        if (dragState.type === 'resize-t') dyAxis = -localDy;
        if (dragState.type === 'resize-b') dyAxis = localDy;

        // Ratios are RELATIVE to the size at drag start; they must therefore be
        // applied to the initial scale, not used as an absolute percentage.
        // Previously `finalScale = sx * 100` threw the current scale away, so
        // grabbing an edge on a clip at 200% snapped it straight down to ~107%
        // on the very first pixel of movement (and up to ~127% from 50%).
        const initScaleEdge = dragState.initTransform.scale || 100;
        const sx = (baseW + dxAxis * 2) / baseW;
        const sy = (baseH + dyAxis * 2) / baseH;

        // Aspect lock: use the dominant axis when Shift is held
        const aspectLocked = e.shiftKey;
        let ratio: number;
        if (aspectLocked) {
          ratio = Math.max(sx, sy);
        } else if (Math.abs(dxAxis) > Math.abs(dyAxis)) {
          ratio = sx;
        } else {
          ratio = sy;
        }

        scale = Math.max(10, Math.min(1000, initScaleEdge * ratio));
        if (!e.altKey) scale = Math.round(scale * 10) / 10;
        // Rescale the whole scale track (see scaleAnimationTrack) rather than
        // dropping a single keyframe, so an existing animation cannot snap the
        // clip back to its old size later.
        scaleAnimationTrack('transform.scale', scale / (initScaleEdge || 100));
      } else {
        // Corner resize (resize-tl/tr/bl/br)
        // Same correction as rotation: clip-local centre + viewport-aware pointer.
        // Using (427, 240) and raw overlay units assumed zoom=1/pan=0, so grabbing
        // a corner under any zoom or pan produced an immediate scale jump before
        // the pointer had really moved.
        const cx = offsetX + W / 2 + x;
        const cy = offsetY + H / 2 + y;
        const ptrAbs = clientToViewportSpace(clientX, clientY, rect, viewport);
        const mx = ptrAbs.x;
        const my = ptrAbs.y;
        const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);

        // Scale from the RATIO of the pointer's distance now vs at mousedown.
        //
        // The old code compared the live distance against a computed corner radius
        // (origDist). Two things made that jump the instant a handle was touched:
        //
        //   1. The pointer never lands exactly on the corner — the handle is ~12
        //      units across — and that grab offset was applied immediately as a
        //      scale change (up to ~4% just from where inside the handle you
        //      clicked, and more when zoomed out).
        //   2. origDist used CROP-ADJUSTED spans while the handles are drawn at the
        //      un-cropped ±baseW/2, ±baseH/2. With any crop the two disagreed
        //      badly — a 25% crop on all sides produced an instant 200% jump.
        //
        // Using the recorded grab distance makes the gesture relative: at the
        // moment of grabbing the ratio is exactly 1, so nothing moves until the
        // pointer actually does. `initPointerDist` is measured with the same
        // centre and the same viewport-aware mapping, so the two are consistent.
        const grabDist = dragState.initPointerDist;
        const initScaleCorner = dragState.initTransform.scale || 100;

        if (grabDist !== undefined && grabDist > 1) {
          scale = initScaleCorner * (dist / grabDist);
        } else {
          // Degenerate grab (pointer effectively on the centre): fall back to the
          // geometric radius rather than dividing by ~0.
          const wSpanFallback = baseW / 2;
          const hSpanFallback = baseH / 2;
          const origDist = Math.hypot(wSpanFallback, hSpanFallback) * (initScaleCorner / 100);
          scale = origDist > 0 ? initScaleCorner * (dist / origDist) : initScaleCorner;
        }

        // Aspect lock for corners: Shift drives scale from whichever axis the
        // pointer has moved most, as a ratio against that axis' grab distance —
        // so it starts at exactly 1 and cannot jump either.
        if (e.shiftKey) {
          const gx = dragState.initPointerDx ?? 0;
          const gy = dragState.initPointerDy ?? 0;
          const nx = Math.abs(mx - cx);
          const ny = Math.abs(my - cy);
          const useX = Math.abs(nx - gx) >= Math.abs(ny - gy);
          const grabAxis = useX ? gx : gy;
          const nowAxis = useX ? nx : ny;
          if (grabAxis > 1) scale = initScaleCorner * (nowAxis / grabAxis);
        }

        scale = Math.max(10, Math.min(1000, e.altKey ? scale : Math.round(scale * 10) / 10));
        scaleAnimationTrack('transform.scale', scale / (initScaleCorner || 100));
      }

      updateClip(activeClip.id, { transform: { ...activeClip.transform, x, y, scale, rotation }, crop, animations });
    };

    const handleUp = () => {
      setDragState(null);
      setSnapGuides([]);
      useEditorStore.getState().saveSnapshot();
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    window.addEventListener('touchcancel', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
      window.removeEventListener('touchcancel', handleUp);
    };
  }, [dragState, activeClip, updateClip, mediaItem, videoElements, viewport, currentTime, aspectRatio]);

  // ── Motion-tracked region editing (FX tab) ────────────────────────────────
  //
  // Region boxes are stored as CornerPoints in absolute 854x480 preview space,
  // which is exactly the space `clientToViewportSpace` returns — so pointer
  // positions map onto them directly, with no clip transform involved.
  const motionEffects: any[] = (activeClip as any)?.motionEffects ?? [];
  // Region overlays appear only while the user is actively adding or editing a
  // region, so they do not clutter the canvas the rest of the time.
  const showRegions =
    activePropertiesTab === 'effects' &&
    motionEffects.length > 0 &&
    editingRegionIndex !== null;

  /** True while a region is being placed — the clip transform must stand down. */
  const regionEditActive = showRegions;

  /** Visible picture size for the CURRENT aspect ratio (single source of truth). */
  const frame = getFrameSize(aspectRatio);
  const frameOff = getFrameOffset(aspectRatio);

  /**
   * Client (mouse) position -> FRAME space, i.e. the space region boxes and
   * painted strokes are stored in: (0,0) is the top-left of the visible picture.
   *
   * `clientToViewportSpace` undoes the letterboxing of the SVG element and the
   * viewport pan/zoom, but leaves the result in raw 854x480 overlay units. The
   * region overlay is drawn inside a `translate(offsetX, offsetY)` group, so the
   * offset has to come off exactly once here. Getting this wrong in either
   * direction is what put the box off-canvas and made the brush miss the cursor.
   */
  const clientToFrame = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const container = document.getElementById('preview-canvas-wrapper');
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const p = clientToViewportSpace(clientX, clientY, rect, viewport);
    return { x: p.x - frameOff.offsetX, y: p.y - frameOff.offsetY };
  };

  const regionRect = (c: any) => {
    // Defaults follow the FRAME, not a hard-coded 16:9 centre. The old
    // (427, 240) fallback sits outside every portrait and square project.
    const norm = normalizeRegionToFrame(c, frame.W, frame.H);
    return quadToRect(norm);
  };

  const rectToCorners = (cx: number, cy: number, w: number, h: number) => rectToQuad(cx, cy, w, h);

  const writeRegion = (index: number, cx: number, cy: number, w: number, h: number) => {
    if (!activeClip) return;
    const next = motionEffects.map((m: any, i: number) =>
      i === index
        ? {
            ...m,
            baseCorners: rectToCorners(cx, cy, w, h),
            // Moving or resizing the box invalidates any existing trajectory —
            // it was tracked from the old position.
            track: undefined,
          }
        : m
    );
    updateClip(activeClip.id, { motionEffects: next } as any);
  };

  /**
   * Rasterise a painted polyline into a binary stroke mask and store it on the
   * effect, along with a bounding box so box-mode controls still make sense.
   *
   * Stored at a modest 240px-wide resolution: the signature only needs the
   * colours under the brush, and keeping it small keeps the project file light.
   */
  const commitPaintStroke = (index: number, points: Array<{ x: number; y: number }>, brush: number) => {
    if (!activeClip || points.length === 0) return;

    // The stroke mask covers the VISIBLE picture, not a notional 854x480 box.
    // Rasterising a portrait project against a 16:9 grid squashed every stroke
    // horizontally and shifted it, so the colour signature was sampled from the
    // wrong pixels even when the user painted in the right place.
    const MW = 240;
    const MH = Math.max(2, Math.round((MW * frame.H) / frame.W));
    const cnv = document.createElement('canvas');
    cnv.width = MW;
    cnv.height = MH;
    const c = cnv.getContext('2d');
    if (!c) return;

    const toMaskX = (x: number) => (x * MW) / frame.W;
    const toMaskY = (y: number) => (y * MH) / frame.H;

    c.fillStyle = '#000';
    c.fillRect(0, 0, MW, MH);
    c.strokeStyle = '#fff';
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = Math.max(2, (brush * MW) / frame.W);
    c.beginPath();
    points.forEach((pt, i) => {
      const x = toMaskX(pt.x);
      const y = toMaskY(pt.y);
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    });
    // A single tap should still paint a dot, not nothing.
    if (points.length === 1) {
      c.lineTo(toMaskX(points[0].x) + 0.01, toMaskY(points[0].y));
    }
    c.stroke();

    const img = c.getImageData(0, 0, MW, MH);
    const stroke = new Uint8Array(MW * MH);
    for (let i = 0; i < stroke.length; i++) {
      stroke[i] = img.data[i * 4] > 127 ? 1 : 0;
    }

    // Bounding box of the stroke, so the box controls and the initial preview
    // reflect what was painted.
    let minX = MW, minY = MH, maxX = -1, maxY = -1;
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        if (stroke[y * MW + x]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const next = motionEffects.map((m: any, i: number) => {
      if (i !== index) return m;
      const patched: any = {
        ...m,
        regionMode: 'paint',
        strokeRle: encodeMaskRle(new Uint8ClampedArray(stroke.map((v) => (v ? 255 : 0)))),
        strokeWidth: MW,
        strokeHeight: MH,
        // A new stroke invalidates the old analysis — it described different pixels.
        maskCache: undefined,
        colorSignature: undefined,
      };
      if (maxX >= 0) {
        const bx0 = (minX / MW) * frame.W;
        const bx1 = (maxX / MW) * frame.W;
        const by0 = (minY / MH) * frame.H;
        const by1 = (maxY / MH) * frame.H;
        patched.baseCorners = {
          x0: bx0, y0: by0,
          x1: bx1, y1: by0,
          x2: bx1, y2: by1,
          x3: bx0, y3: by1,
        };
      }
      return patched;
    });

    updateClip(activeClip.id, { motionEffects: next } as any);
    useEditorStore.getState().saveSnapshot('Paint Motion Region');
  };

  // Paint interaction: pointer events on a full-frame capture rect.
  useEffect(() => {
    if (!paintStroke || !activeClip) return;

    const onMove = (e: MouseEvent) => {
      const p = clientToFrame(e.clientX, e.clientY);
      if (!p) return;
      // Keep the brush ring glued to the pointer while the stroke is in progress —
      // the capture rect stops receiving mousemove once the drag leaves it.
      setBrushCursor(p);
      setPaintStroke((prev) => (prev ? { ...prev, points: [...prev.points, p] } : prev));
    };

    const onUp = () => {
      setPaintStroke((prev) => {
        if (prev) {
          const brush = motionEffects[prev.index]?.brushSize ?? 40;
          commitPaintStroke(prev.index, prev.points, brush);
        }
        return null;
      });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintStroke, activeClip, viewport, motionEffects]);

  const beginRegionDrag = (
    e: React.MouseEvent,
    index: number,
    mode: 'move' | 'nw' | 'ne' | 'se' | 'sw'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const r = regionRect(motionEffects[index]?.baseCorners);
    setRegionDrag({ index, mode, startX: e.clientX, startY: e.clientY, init: r });
  };

  useEffect(() => {
    if (!regionDrag || !activeClip) return;

    const onMove = (e: MouseEvent) => {
      const container = document.getElementById('preview-canvas-wrapper');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      // Same viewport-aware mapping the transform handles use, so the box tracks
      // the cursor exactly under any zoom or pan.
      const { scale } = getOverlayMapping(rect);
      const dx = ((e.clientX - regionDrag.startX) * scale) / (viewport.zoom || 1);
      const dy = ((e.clientY - regionDrag.startY) * scale) / (viewport.zoom || 1);

      const { cx, cy, w, h } = regionDrag.init;
      let nx = cx, ny = cy, nw = w, nh = h;

      if (regionDrag.mode === 'move') {
        nx = cx + dx;
        ny = cy + dy;
      } else {
        // Resize from a corner: the opposite corner stays pinned.
        const signX = regionDrag.mode === 'ne' || regionDrag.mode === 'se' ? 1 : -1;
        const signY = regionDrag.mode === 'se' || regionDrag.mode === 'sw' ? 1 : -1;
        nw = Math.max(16, w + dx * signX * 2);
        nh = Math.max(16, h + dy * signY * 2);
      }

      // Keep the box inside the VISIBLE picture; a region dragged into the
      // letterbox bars has no pixels to track. Clamping against 854x480 (the
      // overlay box, not the frame) let it wander off the picture entirely.
      nw = Math.min(nw, frame.W);
      nh = Math.min(nh, frame.H);
      nx = Math.max(nw / 2, Math.min(frame.W - nw / 2, nx));
      ny = Math.max(nh / 2, Math.min(frame.H - nh / 2, ny));

      writeRegion(regionDrag.index, nx, ny, nw, nh);
    };

    const onUp = () => {
      setRegionDrag(null);
      useEditorStore.getState().saveSnapshot('Adjust Motion Region');
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionDrag, activeClip, viewport, motionEffects]);

  const clientToImagePixel = (e: React.PointerEvent<SVGElement>): { x: number; y: number } | null => {
    const svgEl = e.currentTarget.closest('svg') as SVGSVGElement | null;
    if (!svgEl) return null;

    const img = getCachedImage(mediaItem!.id, mediaItem!.url as string, () => {});
    const imageW = img?.naturalWidth || 1920;
    const imageH = img?.naturalHeight || 1080;

    const target = e.currentTarget as unknown as SVGGraphicsElement;
    const ctm = target.getScreenCTM();
    if (!ctm) return null;
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const localPt = pt.matrixTransform(ctm.inverse());

    const imgX = Math.round(((localPt.x + baseW / 2) / baseW) * imageW);
    const imgY = Math.round(((localPt.y + baseH / 2) / baseH) * imageH);

    return {
      x: Math.max(0, Math.min(imageW - 1, imgX)),
      y: Math.max(0, Math.min(imageH - 1, imgY))
    };
  };

  const handleEditorPointerDown = (e: React.PointerEvent<SVGElement>) => {
    if (!activeClip || !mediaItem || imageEditorTool === 'none') return;
    e.stopPropagation();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}

    const img = getCachedImage(mediaItem.id, mediaItem.url as string, () => {});
    if (imageEditorTool === 'magic' && !img) {
      toast.info('Image is still loading. Please try again in a moment.');
      return;
    }

    const imgPos = clientToImagePixel(e);
    if (!imgPos) return;

    const imageW = img?.naturalWidth || 1920;
    const imageH = img?.naturalHeight || 1080;

    if (imageEditorTool === 'magic' || imageEditorTool === 'lasso') {
      isDrawingRef.current = true;
      setSelectionPath([{ x: imgPos.x, y: imgPos.y }]);
      setSelectionMask(null);
    } else if (imageEditorTool === 'poly') {
      setSelectionMask(null);
      if (selectionPath.length > 2) {
        const first = selectionPath[0];
        const dist = Math.sqrt((imgPos.x - first.x) ** 2 + (imgPos.y - first.y) ** 2);
        const closeThreshold = Math.max(15, imageW * 0.01);
        if (dist < closeThreshold) {
          setSelectionPath(prev => [...prev, { x: first.x, y: first.y }]);
          return;
        }
      }
      setSelectionPath(prev => [...prev, { x: imgPos.x, y: imgPos.y }]);
    }
  };

  const handleEditorPointerMove = (e: React.PointerEvent<SVGElement>) => {
    if (!activeClip || !mediaItem || !isDrawingRef.current || (imageEditorTool !== 'lasso' && imageEditorTool !== 'magic')) return;
    const imgPos = clientToImagePixel(e);
    if (!imgPos) return;
    setSelectionPath(prev => [...prev, { x: imgPos.x, y: imgPos.y }]);
  };

  const handleEditorPointerUp = () => {
    if (imageEditorTool === 'lasso' || imageEditorTool === 'magic') {
      isDrawingRef.current = false;
      if (selectionPath.length > 2) {
        const closedPath = [...selectionPath, { x: selectionPath[0].x, y: selectionPath[0].y }];
        setSelectionPath(closedPath);
        if (imageEditorTool === 'magic') {
          processSmartSelection(closedPath);
        }
      }
    }
  };

  const processSmartSelection = async (path: {x: number, y: number}[]) => {
    if (!activeClip || !mediaItem || mediaItem.type !== 'image') return;
    
    let imageW = 1920;
    let imageH = 1080;
    const img = getCachedImage(mediaItem.id, mediaItem.url as string, () => {});
    if (!img || img.naturalWidth === 0) {
      toast.error('Image not fully loaded yet.');
      return;
    }
    imageW = img.naturalWidth;
    imageH = img.naturalHeight;

    let minX = imageW, minY = imageH, maxX = 0, maxY = 0;
    path.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });

    const pad = Math.max(20, (maxX - minX) * 0.1);
    minX = Math.max(0, Math.floor(minX - pad));
    minY = Math.max(0, Math.floor(minY - pad));
    maxX = Math.min(imageW, Math.ceil(maxX + pad));
    maxY = Math.min(imageH, Math.ceil(maxY + pad));

    const boxW = maxX - minX;
    const boxH = maxY - minY;
    
    if (boxW <= 10 || boxH <= 10) {
      setSelectionPath([]);
      toast.error('Selection too small.');
      return;
    }

    setIsProcessingSelection(true);
    const toastId = toast.loading('Running ML segmentation on selection...');

    try {
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = boxW;
      cropCanvas.height = boxH;
      const cropCtx = cropCanvas.getContext('2d')!;
      cropCtx.drawImage(img, minX, minY, boxW, boxH, 0, 0, boxW, boxH);

      const blob = await new Promise<Blob | null>(resolve => cropCanvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Failed to create blob for cropping');

      const resultBlob = await removeBackground(blob, {
        publicPath: 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/',
        progress: (key: string, current: number, total: number) => {}
      });

      const resultImg = new Image();
      const resultUrl = URL.createObjectURL(resultBlob);
      try {
        await new Promise((resolve, reject) => {
          resultImg.onload = () => resolve(null);
          resultImg.onerror = reject;
          resultImg.src = resultUrl;
        });
      } finally {
        URL.revokeObjectURL(resultUrl);
      }

      const fullMaskCanvas = document.createElement('canvas');
      fullMaskCanvas.width = imageW;
      fullMaskCanvas.height = imageH;
      const fullMaskCtx = fullMaskCanvas.getContext('2d')!;
      fullMaskCtx.fillStyle = 'black';
      fullMaskCtx.fillRect(0, 0, imageW, imageH);
      
      fullMaskCtx.drawImage(resultImg, minX, minY, boxW, boxH);
      
      const fullMaskData = fullMaskCtx.getImageData(0, 0, imageW, imageH);
      const mask = new Uint8ClampedArray(imageW * imageH);
      
      for (let i = 0; i < mask.length; i++) {
        mask[i] = fullMaskData.data[i * 4 + 3];
      }
      
      setSelectionMask(mask);
      setSelectionPath([]);
      toast.success('Smart selection completed!', { id: toastId });
    } catch (error) {
      console.error('Smart selection error:', error);
      toast.error('Smart selection failed. Falling back to manual lasso.', { id: toastId });
    } finally {
      setIsProcessingSelection(false);
    }
  };

  const applyEditorAction = async (action: 'delete' | 'remove' | 'erase') => {
    if (!activeClip || !mediaItem || mediaItem.type !== 'image') return;

    let imageW = 1920;
    let imageH = 1080;
    const img = getCachedImage(mediaItem.id, mediaItem.url as string, () => {});
    if (img && img.naturalWidth > 0) {
      imageW = img.naturalWidth;
      imageH = img.naturalHeight;
    }

    const canvas = document.createElement('canvas');
    canvas.width = imageW;
    canvas.height = imageH;
    const ctx = canvas.getContext('2d')!;
    if (img) {
      ctx.drawImage(img, 0, 0, imageW, imageH);
    }
    const imgData = ctx.getImageData(0, 0, imageW, imageH);
    const pixels = imgData.data;

    let mask: any = new Uint8ClampedArray(imageW * imageH);
    if (selectionMask) {
      mask = selectionMask;
    } else if (selectionPath.length > 2) {
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = imageW;
      maskCanvas.height = imageH;
      const maskCtx = maskCanvas.getContext('2d')!;
      maskCtx.fillStyle = 'black';
      maskCtx.fillRect(0, 0, imageW, imageH);
      maskCtx.fillStyle = 'white';
      maskCtx.beginPath();
      selectionPath.forEach((p, idx) => {
        if (idx === 0) maskCtx.moveTo(p.x, p.y);
        else maskCtx.lineTo(p.x, p.y);
      });
      maskCtx.closePath();
      maskCtx.fill();

      const maskImgData = maskCtx.getImageData(0, 0, imageW, imageH);
      for (let i = 0; i < mask.length; i++) {
        mask[i] = maskImgData.data[i * 4];
      }
    } else {
      toast.error('Please make a selection first.');
      return;
    }

    if (action === 'delete') {
      for (let i = 0; i < mask.length; i++) {
        if (mask[i] > 128) {
          const idx = i * 4;
          pixels[idx] = 0;
          pixels[idx + 1] = 0;
          pixels[idx + 2] = 0;
          pixels[idx + 3] = 255;
        }
      }
    } else if (action === 'erase') {
      for (let i = 0; i < mask.length; i++) {
        if (mask[i] > 128) {
          pixels[i * 4 + 3] = 0;
        }
      }
    } else if (action === 'remove') {
      inpaint(imgData, mask);
    }

    ctx.putImageData(imgData, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        toast.error('Failed to apply edits.');
        return;
      }

      const editedUrl = URL.createObjectURL(blob);
      const newMediaId = `img_edit_${Date.now()}`;
      const newFile = new File([blob], `edited_${mediaItem.name}.png`, { type: 'image/png' });

      try {
        await saveFileToDB(newMediaId, newFile);

        const newMediaItem = {
          id: newMediaId,
          name: `Edited ${mediaItem.name}`,
          type: 'image' as const,
          duration: mediaItem.duration || 10,
          url: editedUrl,
          thumbnail: editedUrl,
          size: blob.size,
          createdAt: Date.now()
        };

        useEditorStore.setState((state) => ({
          mediaLibrary: [...state.mediaLibrary, newMediaItem]
        }));

        updateClip(activeClip.id, {
          mediaId: newMediaId
        });

        setSelectionPath([]);
        setSelectionMask(null);
        toast.success(`Image edit applied successfully (${action})!`);
      } catch (err) {
        console.error(err);
        toast.error('Error saving edited image.');
      }
    }, 'image/png');
  };

  const getRenderedSelectionPoints = () => {
    if (!activeClip || !mediaItem) return '';
    let imageW = mediaItem.width || 1920;
    let imageH = mediaItem.height || 1080;
    const img = getCachedImage(mediaItem.id, mediaItem.url as string, () => {});
    if (img && img.naturalWidth > 0) {
      imageW = img.naturalWidth;
      imageH = img.naturalHeight;
    }

    let vw = 854;
    let vh = 480;
    if (mediaItem?.type === 'video' || mediaItem?.type === 'image') {
      vw = mediaItem.width || 1920;
      vh = mediaItem.height || 1080;
    }
    let scaleToFit = 1;
    if (mediaItem?.type === 'video' || mediaItem?.type === 'image') {
      scaleToFit = Math.min(854 / (vw || 1), 480 / (vh || 1));
    }
    const bW = vw * scaleToFit;
    const bH = vh * scaleToFit;

    return selectionPath.map(p => {
      const localX = (p.x / imageW) * bW - bW / 2;
      const localY = (p.y / imageH) * bH - bH / 2;
      return `${localX},${localY}`;
    }).join(' ');
  };

  const maskDataUrl = useMemo(() => {
    if (!selectionMask || !mediaItem) return null;
    let imageW = mediaItem.width || 1920;
    let imageH = mediaItem.height || 1080;
    const img = getCachedImage(mediaItem.id, mediaItem.url as string, () => {});
    if (img && img.naturalWidth > 0) {
      imageW = img.naturalWidth;
      imageH = img.naturalHeight;
    }

    const canvas = document.createElement('canvas');
    canvas.width = imageW;
    canvas.height = imageH;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(imageW, imageH);
    const pixels = imgData.data;

    for (let i = 0; i < selectionMask.length; i++) {
      if (selectionMask[i] > 128) {
        pixels[i * 4] = 59;
        pixels[i * 4 + 1] = 130;
        pixels[i * 4 + 2] = 246;
        pixels[i * 4 + 3] = 115;
      } else {
        pixels[i * 4 + 3] = 0;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const dataUrl = canvas.toDataURL();
    canvas.width = 0;
    canvas.height = 0;
    return dataUrl;
  }, [selectionMask, mediaItem?.id, mediaItem?.width, mediaItem?.height]);

  const renderVirtualCamera = () => {
    if (!virtualCamera.enabled) return null;
    const currentCamPos = { x: 0, y: 0 };
    const currentKeyframes = virtualCamera.keyframes[virtualCamera.aspectRatio] || [];
    if (currentKeyframes.length > 0) {
      const sorted = [...currentKeyframes].sort((a, b) => a.time - b.time);
      let before = sorted[0];
      let after = sorted[sorted.length - 1];
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].time <= currentTime && sorted[i + 1].time >= currentTime) {
          before = sorted[i];
          after = sorted[i + 1];
          break;
        }
      }
      if (before === after || currentTime <= before.time) {
        currentCamPos.x = before.x;
        currentCamPos.y = before.y;
      } else if (currentTime >= after.time) {
        currentCamPos.x = after.x;
        currentCamPos.y = after.y;
      } else {
        const t = (currentTime - before.time) / (after.time - before.time);
        currentCamPos.x = before.x + (after.x - before.x) * t;
        currentCamPos.y = before.y + (after.y - before.y) * t;
      }
    }
    
    let targetW = 854;
    let targetH = 480;
    if (virtualCamera.aspectRatio === '9:16') {
      targetW = 480 * (9/16);
      targetH = 480;
    } else if (virtualCamera.aspectRatio === '1:1') {
      targetW = 480;
      targetH = 480;
    } else if (virtualCamera.aspectRatio === '4:3') {
      targetW = 480 * (4/3);
      targetH = 480;
    }
    
    const absX = (currentCamPos.x * 854) + 427;
    const absY = (currentCamPos.y * 480) + 240;

    return (
      <g 
        transform={`translate(${absX}, ${absY}) scale(${viewport.zoom})`}
        className="pointer-events-auto cursor-move focus:outline-none"
        onMouseDown={(e) => {
          e.stopPropagation();
          setDragState({
            type: 'virtualCamera',
            startX: e.clientX,
            startY: e.clientY,
            initTransform: {},
            initCrop: {},
            initVirtualCamera: { x: currentCamPos.x, y: currentCamPos.y }
          });
        }}
      >
        <rect
          x={-targetW / 2}
          y={-targetH / 2}
          width={targetW}
          height={targetH}
          fill="transparent"
          stroke="transparent"
          strokeWidth={20 / viewport.zoom}
        />
        <rect
          x={-targetW / 2}
          y={-targetH / 2}
          width={targetW}
          height={targetH}
          fill="rgba(251, 191, 36, 0.05)"
          stroke="#fbbf24"
          strokeWidth={2 / viewport.zoom}
          strokeDasharray="8,4"
        />
        <circle cx="0" cy="0" r={4 / viewport.zoom} fill="#fbbf24" />
      </g>
    );
  };

  if (!activeClip) {
    if (!virtualCamera.enabled) return null;
    return (
      <div className="absolute inset-0 pointer-events-none" id="preview-canvas-wrapper-overlay">
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox="0 0 854 480">
          <g transform={`translate(${854 / 2 + viewport.x - 854 / 2 * viewport.zoom}, ${480 / 2 + viewport.y - 480 / 2 * viewport.zoom})`}>
            {renderVirtualCamera()}
          </g>
        </svg>
      </div>
    );
  }

  let viewW = 854;
  let viewH = 480;
  if (aspectRatio === '9:16') {
    viewW = Math.round(480 * (9 / 16));
  } else if (aspectRatio === '1:1') {
    viewW = 480;
  } else if (aspectRatio === '4:3') {
    viewW = Math.round(480 * (4 / 3));
  }
  const W = viewW;
  const H = viewH;
  const offsetX = (854 - viewW) / 2;
  const offsetY = (480 - viewH) / 2;

  let vw = mediaItem?.width || 1920;
  let vh = mediaItem?.height || 1080;
  // Set when the selection box is measured from PiP word layers whose stored
  // positions already include the container transform (see below).
  let isKineticSentenceBox = false;
  let kineticBoxCentre = { x: 0, y: 0 };
  if (mediaItem?.type === 'video') {
    const v = videoElements.get(activeClip.id);
    if (v && v.videoWidth > 0) {
      vw = v.videoWidth;
      vh = v.videoHeight;
    }
  } else if (mediaItem?.type === 'image') {
    const img = getCachedImage(mediaItem.id, mediaItem.url as string, () => {});
    if (img && img.naturalWidth > 0) {
      vw = img.naturalWidth;
      vh = img.naturalHeight;
    }
  } else if (mediaItem?.type === 'text' || (activeClip as any).textSettings || (activeClip as any).mediaId === 'text-placeholder') {
    const ts = (activeClip as any).textSettings;

    // A Hybrid kinetic sentence is an INVISIBLE container clip; the words the user
    // sees are separate clips inside its PiP window, already wrapped onto several
    // lines. Measuring the container's own text metrics treated the sentence as
    // one long unwrapped line, so the selection box did not match the rendered
    // block at all. Measure the actual word layers instead.
    const kineticPipId = isKineticMediaId((activeClip as any).mediaId)
      ? (activeClip as any).pipWindowIds?.[0]
      : undefined;
    const kineticPip = kineticPipId ? (pipWindows as any)?.[kineticPipId] : null;

    let measured = false;
    if (kineticPip) {
      const laid: { text: string; x: number; y: number; fontSize: number }[] = [];
      for (const track of kineticPip.tracks || []) {
        if (track.type !== 'text') continue;
        const wc = track.clips?.[0];
        if (!wc) continue;
        laid.push({
          text: String(wc.textSettings?.text || ''),
          x: wc.transform?.x ?? 0,
          y: wc.transform?.y ?? 0,
          fontSize: Number(wc.textSettings?.fontSize) || 48,
        });
      }
      const bounds = getSentenceBounds(laid);
      if (bounds) {
        // Word transforms are stored UNSCALED and relative to the container, so
        // this extent is already the correct BASE size. The SVG applies
        // `scale(aScale / 100)` and the container's x/y on top exactly once.
        //
        // (Previously the reflow baked the container's scale and offset into the
        // word positions as well. Measuring those and then letting the renderer
        // transform them again applied both twice — the box shrank and drifted
        // further on every single drag.)
        // Word positions are now stored in the container's LOCAL space (the
        // renderer applies the container transform to PiP children), so these
        // bounds are the un-transformed base extent. The standard
        // translate(aX,aY) scale(aScale) group below transforms them exactly once.
        vw = Math.max(80, bounds.width + 40);
        vh = Math.max(40, bounds.height + 20);
        isKineticSentenceBox = true;
        kineticBoxCentre = { x: bounds.x, y: bounds.y };
        measured = true;
      }
    }

    if (!measured) {
      if (ts) {
        const fontSize = Number(ts.fontSize) || 48;
        const text = String(ts.text || '');
        const lines = text.split('\n');
        const estCharWidth = fontSize * 0.75;
        const longestLine = lines.reduce((max, l) => Math.max(max, l.length), 0);
        const bgPad = (ts.backgroundColor && ts.backgroundColor !== 'transparent') ? fontSize * 0.5 * 2 : 0;
        const strokePad = (ts.strokeColor && ts.strokeWidth) ? Number(ts.strokeWidth) * 2 : 0;
        const shadowPad = ts.shadow ? (Number(ts.shadowBlur) || 10) * 2 + 10 : 0;
        vw = Math.max(80, Math.ceil(longestLine * estCharWidth + bgPad + strokePad + shadowPad + 40));
        vh = Math.max(40, Math.ceil(lines.length * (fontSize * 1.35) + bgPad + strokePad + shadowPad + 20));
      } else {
        vw = 300;
        vh = 80;
      }
    }
  }

  let scaleToFit = 1;
  if (mediaItem?.type === 'video' || mediaItem?.type === 'image') {
    scaleToFit = Math.min(W / vw, H / vh);
  }
  const baseW = vw * scaleToFit;
  const baseH = vh * scaleToFit;

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent, type: string) => {
    e.stopPropagation();
    // Belt and braces: even if a transform handle is somehow still reachable
    // while a motion region is being placed, refuse to start a clip drag. The
    // region must be positionable without the shot moving underneath it.
    if (regionEditActive) return;
    const clientX = 'touches' in e && e.touches[0] ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e && e.touches[0] ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const mask = activeClip?.mask || { x: 50, y: 50, width: 50, height: 50, rotation: 0, feather: 0, roundness: 0 };

    const baseTransform = activeClip?.transform ?? { x: 0, y: 0, scale: 100, rotation: 0 };
    const hasKf = (prop: string) => !!activeClip?.animations?.[prop]?.length;
    const framing =
      activeClip && perRatioFramingEnabled ? perRatioFraming[aspectRatio]?.[activeClip.id] : undefined;

    setDragState({
      type,
      startX: clientX,
      startY: clientY,
      initTransform: {
        x: (hasKf('transform.x') ? aX : baseTransform.x ?? 0) - (framing?.x ?? 0),
        y: (hasKf('transform.y') ? aY : baseTransform.y ?? 0) - (framing?.y ?? 0),
        // Always seed scale from the BASE, even when a keyframe track exists.
        //
        // Resizing now rescales the whole track proportionally and also writes the
        // new base, so base and track stay in agreement. Seeding from the animated
        // value instead meant a later MOVE (which never touches the scale track)
        // wrote that sampled value back as the base — for a kinetic word, whose
        // pop keyframe settles at 100%, that silently reset a resized clip to
        // 100% the moment it was dragged.
        scale:
          (baseTransform.scale ?? 100) /
          (framing?.scale !== undefined ? framing.scale / 100 : 1),
        rotation: hasKf('transform.rotation') ? aRot : baseTransform.rotation ?? 0,
      },
      // Distance from the clip centre to the pointer at the moment of grabbing.
      // Corner resize uses the RATIO against this, so clicking anywhere inside the
      // handle (it is ~12 units across) no longer instantly rescales the clip.
      ...(() => {
        const container = document.getElementById('preview-canvas-wrapper');
        if (!container) return {};
        const r = container.getBoundingClientRect();
        const p = clientToViewportSpace(clientX, clientY, r, viewport);
        const gx = Math.abs(p.x - (offsetX + W / 2 + aX));
        const gy = Math.abs(p.y - (offsetY + H / 2 + aY));
        return {
          initPointerDist: Math.hypot(gx, gy),
          initPointerDx: gx,
          initPointerDy: gy,
          initPointerAngle:
            (Math.atan2(
              p.y - (offsetY + H / 2 + aY),
              p.x - (offsetX + W / 2 + aX)
            ) *
              180) /
            Math.PI,
        };
      })(),
      initCrop: { left: aCropLeft, top: aCropTop, right: aCropRight, bottom: aCropBot },
      initMask: { ...mask },
      // Resize maths expects the UNSCALED base extent (it applies transform.scale
      // itself). For a kinetic sentence, baseW/baseH were measured from word
      // layers that already include that scale, so divide it back out — otherwise
      // each resize is computed against an inflated base and the scale runs away.
      // Bounds are measured in local (unscaled) space now, so no de-scaling.
      baseW,
      baseH,
    });
  };

  const cx = 854 / 2;
  const cy = 480 / 2;
  const totalX = cx + viewport.x - cx * viewport.zoom;
  const totalY = cy + viewport.y - cy * viewport.zoom;

  const pcBase = activeClip.transform.perspectiveCorners || {
    x0: 0,
    y0: 0,
    x1: W,
    y1: 0,
    x2: W,
    y2: H,
    x3: 0,
    y3: H
  };

  let pc = { ...pcBase };
  
  if (activeClip.transform.perspectivePin) {
    let trackedCorners = null;
    const trackingData = activeClip.transform.perspectiveTrackingData;
    if (trackingData && trackingData.length > 0) {
      const localTime = currentTime - activeClip.startTime;
      let closestDist = Infinity;
      for (const pt of trackingData) {
        const dist = Math.abs(pt.time - localTime);
        if (dist < closestDist) {
          closestDist = dist;
          trackedCorners = pt.corners;
        }
      }
    }
    
    if (trackedCorners) {
      pc = { ...trackedCorners };
    } else {
      pc = {
        x0: getAnimatedValue(pcBase.x0, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.x0']),
        y0: getAnimatedValue(pcBase.y0, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.y0']),
        x1: getAnimatedValue(pcBase.x1, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.x1']),
        y1: getAnimatedValue(pcBase.y1, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.y1']),
        x2: getAnimatedValue(pcBase.x2, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.x2']),
        y2: getAnimatedValue(pcBase.y2, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.y2']),
        x3: getAnimatedValue(pcBase.x3, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.x3']),
        y3: getAnimatedValue(pcBase.y3, currentTime, activeClip.startTime, activeClip.animations?.['transform.perspectiveCorners.y3']),
      };
    }
  }

  let renderedPc = { ...pc };
  if (activeClip.transform.perspectivePin) {
    const ccx = (pc.x0 + pc.x1 + pc.x2 + pc.x3) / 4;
    const ccy = (pc.y0 + pc.y1 + pc.y2 + pc.y3) / 4;
    const scale = aScale / 100;
    const rotRad = (aRot * Math.PI) / 180;
    const cos = Math.cos(rotRad);
    const sin = Math.sin(rotRad);

    const transformCorner = (x: number, y: number) => {
      let dx = x - ccx;
      let dy = y - ccy;
      dx *= scale;
      dy *= scale;
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      return { x: ccx + rx + aX, y: ccy + ry + aY };
    };

    renderedPc = {
      x0: transformCorner(pc.x0, pc.y0).x, y0: transformCorner(pc.x0, pc.y0).y,
      x1: transformCorner(pc.x1, pc.y1).x, y1: transformCorner(pc.x1, pc.y1).y,
      x2: transformCorner(pc.x2, pc.y2).x, y2: transformCorner(pc.x2, pc.y2).y,
      x3: transformCorner(pc.x3, pc.y3).x, y3: transformCorner(pc.x3, pc.y3).y,
    };
  }

  const handleCornerKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();

    const step = e.shiftKey ? 10 : 1;
    const pcBase = activeClip.transform.perspectiveCorners || {
      x0: 0,
      y0: 0,
      x1: W,
      y1: 0,
      x2: W,
      y2: H,
      x3: 0,
      y3: H
    };

    const newPc = { ...pcBase };
    const keyX = `x${idx}` as keyof typeof newPc;
    const keyY = `y${idx}` as keyof typeof newPc;

    if (e.key === 'ArrowLeft') newPc[keyX] -= step;
    else if (e.key === 'ArrowRight') newPc[keyX] += step;
    else if (e.key === 'ArrowUp') newPc[keyY] -= step;
    else if (e.key === 'ArrowDown') newPc[keyY] += step;

    updateClip(activeClip.id, {
      transform: {
        ...activeClip.transform,
        perspectiveCorners: newPc
      }
    });
    useEditorStore.getState().saveSnapshot();
  };

  const handleHandleKeyDown = (e: React.KeyboardEvent, type: string) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();

    const step = e.shiftKey ? 10 : 1;

    if (type === 'move') {
      let newX = aX;
      let newY = aY;
      if (e.key === 'ArrowLeft') newX -= step;
      else if (e.key === 'ArrowRight') newX += step;
      else if (e.key === 'ArrowUp') newY -= step;
      else if (e.key === 'ArrowDown') newY += step;

      updateClip(activeClip.id, {
        transform: { ...activeClip.transform, x: newX, y: newY }
      });
    } else if (type === 'rot') {
      const rotStep = e.shiftKey ? 5 : 1;
      let newRot = aRot;
      if (e.key === 'ArrowLeft') newRot = (newRot - rotStep) % 360;
      else if (e.key === 'ArrowRight') newRot = (newRot + rotStep) % 360;

      updateClip(activeClip.id, {
        transform: { ...activeClip.transform, rotation: newRot }
      });
    } else if (type.startsWith('resize')) {
      let newScale = aScale;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') newScale = Math.min(1000, newScale + step);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') newScale = Math.max(10, newScale - step);

      updateClip(activeClip.id, {
        transform: { ...activeClip.transform, scale: newScale }
      });
    } else if (type.startsWith('crop-')) {
      const crop = activeClip.crop || { left: 0, top: 0, right: 0, bottom: 0 };
      const newCrop = { ...crop };
      if (type === 'crop-left') {
        if (e.key === 'ArrowLeft') newCrop.left = Math.max(0, newCrop.left - step);
        else if (e.key === 'ArrowRight') newCrop.left = Math.min(100 - newCrop.right, newCrop.left + step);
      } else if (type === 'crop-right') {
        if (e.key === 'ArrowRight') newCrop.right = Math.max(0, newCrop.right - step);
        else if (e.key === 'ArrowLeft') newCrop.right = Math.min(100 - newCrop.left, newCrop.right + step);
      } else if (type === 'crop-top') {
        if (e.key === 'ArrowUp') newCrop.top = Math.max(0, newCrop.top - step);
        else if (e.key === 'ArrowDown') newCrop.top = Math.min(100 - newCrop.bottom, newCrop.top + step);
      } else if (type === 'crop-bottom') {
        if (e.key === 'ArrowDown') newCrop.bottom = Math.max(0, newCrop.bottom - step);
        else if (e.key === 'ArrowUp') newCrop.bottom = Math.min(100 - newCrop.top, newCrop.bottom + step);
      }

      updateClip(activeClip.id, { crop: newCrop });
    }
    useEditorStore.getState().saveSnapshot();
  };

  const handleCornerMouseDown = (e: React.MouseEvent | React.TouchEvent, cornerIdx: number) => {
    e.stopPropagation();
    const clientX = 'touches' in e && e.touches[0] ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e && e.touches[0] ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setDragState({
      type: `perspective-corner-${cornerIdx}`,
      startX: clientX,
      startY: clientY,
      initTransform: null,
      initCrop: null,
      initCorners: { ...pc }
    });
  };

  const mask = activeClip?.mask || { enabled: false, type: 'rectangle', x: 50, y: 50, width: 50, height: 50, rotation: 0, feather: 0, roundness: 0 };
  const maskLocalX = activeClip ? -baseW / 2 + (mask.x / 100) * baseW : 0;
  const maskLocalY = activeClip ? -baseH / 2 + (mask.y / 100) * baseH : 0;
  const maskLocalW = activeClip ? (mask.width / 100) * baseW : 0;
  const maskLocalH = activeClip ? (mask.height / 100) * baseH : 0;
  const maskRot = mask.rotation || 0;

  return (
    <>
      <div className="absolute inset-0 pointer-events-none" id="preview-canvas-wrapper-overlay">
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          viewBox="0 0 854 480"
          role="region"
          aria-label="Interactive canvas overlay"
        >
          <g transform={`translate(${totalX}, ${totalY}) scale(${viewport.zoom}) translate(${offsetX}, ${offsetY})`}>
            {/* ── Motion-tracked region boxes ──────────────────────────────────
                Rendered INSIDE the viewport group (so they pan/zoom with the
                picture) but OUTSIDE the clip-transform group, because a region is
                authored in absolute frame space — it must stay where the user put
                it even if the clip itself is scaled or rotated. */}
            {/* Paint capture surface — only while a region is in paint mode and
                armed. Covers the frame so a stroke can start anywhere. */}
            {showRegions && paintArmedIndex !== null && (
              <rect
                // Covers exactly the VISIBLE picture. It used to be a flat
                // 854x480 placed inside this already-offset group, so on any
                // non-16:9 project it hung off the right-hand edge — you could
                // start a stroke in the black letterbox bar and the coordinates
                // that came back were outside the frame.
                x={0}
                y={0}
                width={W}
                height={H}
                fill="rgba(251,146,60,0.06)"
                className="pointer-events-auto"
                style={{ cursor: 'none' }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const p = clientToFrame(e.clientX, e.clientY);
                  if (!p) return;
                  setPaintStroke({ index: paintArmedIndex, points: [p] });
                }}
                onMouseMove={(e) => {
                  const p = clientToFrame(e.clientX, e.clientY);
                  if (p) setBrushCursor(p);
                }}
                onMouseLeave={() => setBrushCursor(null)}
              />
            )}

            {/* Photoshop-style brush cursor: a circle the exact size of the
                brush, so you can see what you are about to paint. Without it the
                only feedback was the OS crosshair, which told you nothing about
                the brush diameter — the user reported "the circle is not
                showing" and could not tell where the paint would land. */}
            {showRegions && paintArmedIndex !== null && brushCursor && (
              <g className="pointer-events-none">
                <circle
                  cx={brushCursor.x}
                  cy={brushCursor.y}
                  r={Math.max(2, (motionEffects[paintArmedIndex]?.brushSize ?? 40) / 2)}
                  fill="rgba(251,146,60,0.18)"
                  stroke="#fb923c"
                  strokeWidth={1.5 / viewport.zoom}
                />
                <circle
                  cx={brushCursor.x}
                  cy={brushCursor.y}
                  r={Math.max(2, (motionEffects[paintArmedIndex]?.brushSize ?? 40) / 2)}
                  fill="none"
                  stroke="#141414"
                  strokeWidth={0.6 / viewport.zoom}
                  strokeDasharray={`${3 / viewport.zoom},${3 / viewport.zoom}`}
                />
                <circle cx={brushCursor.x} cy={brushCursor.y} r={1.5 / viewport.zoom} fill="#fb923c" />
              </g>
            )}

            {/* Live stroke preview */}
            {paintStroke && paintStroke.points.length > 0 && (
              <polyline
                points={paintStroke.points.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                fill="none"
                stroke="#fb923c"
                strokeOpacity={0.85}
                strokeWidth={(motionEffects[paintStroke.index]?.brushSize ?? 40)}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none"
              />
            )}

            {showRegions && motionEffects.map((me: any, i: number) => {
              if (!me?.enabled) return null;
              // Paint regions show their analysed bounds, not draggable handles —
              // the selection is the painted colour, not the rectangle.
              if (me.regionMode === 'paint') {
                const pr = regionRect(me.baseCorners);
                const hasMask = (me.maskCache?.frames?.length ?? 0) > 0;
                return (
                  <g key={`motion-paint-${i}`} className="pointer-events-none">
                    <rect
                      x={pr.cx - pr.w / 2}
                      y={pr.cy - pr.h / 2}
                      width={pr.w}
                      height={pr.h}
                      fill="none"
                      stroke={hasMask ? '#34d399' : '#fb923c'}
                      strokeWidth={1.5 / viewport.zoom}
                      strokeDasharray={`${3 / viewport.zoom},${3 / viewport.zoom}`}
                      opacity={0.7}
                    />
                    <text
                      x={pr.cx - pr.w / 2}
                      y={pr.cy - pr.h / 2 - 6 / viewport.zoom}
                      fill={hasMask ? '#34d399' : '#fb923c'}
                      fontSize={12 / viewport.zoom}
                      className="select-none"
                    >
                      {`R${i + 1} ${me.type} · paint${hasMask ? ' ✓' : ' (re-track)'}${me.applyMode === 'outside' ? ' · outside' : ''}`}
                    </text>
                  </g>
                );
              }
              const r = regionRect(me.baseCorners);
              const tracked = (me.track?.length ?? 0) > 0;
              const stroke = tracked ? '#34d399' : '#fb923c';
              const hs = 7 / viewport.zoom;
              const corners: Array<['nw' | 'ne' | 'se' | 'sw', number, number]> = [
                ['nw', r.cx - r.w / 2, r.cy - r.h / 2],
                ['ne', r.cx + r.w / 2, r.cy - r.h / 2],
                ['se', r.cx + r.w / 2, r.cy + r.h / 2],
                ['sw', r.cx - r.w / 2, r.cy + r.h / 2],
              ];
              return (
                <g key={`motion-region-${i}`}>
                  <rect
                    x={r.cx - r.w / 2}
                    y={r.cy - r.h / 2}
                    width={r.w}
                    height={r.h}
                    fill="rgba(251,146,60,0.10)"
                    stroke={stroke}
                    strokeWidth={2 / viewport.zoom}
                    strokeDasharray={tracked ? undefined : `${6 / viewport.zoom},${4 / viewport.zoom}`}
                    className="pointer-events-auto cursor-move"
                    onMouseDown={(e) => beginRegionDrag(e, i, 'move')}
                  />
                  <text
                    x={r.cx - r.w / 2}
                    y={r.cy - r.h / 2 - 6 / viewport.zoom}
                    fill={stroke}
                    fontSize={12 / viewport.zoom}
                    className="pointer-events-none select-none"
                  >
                    {`R${i + 1} ${me.type}${tracked ? ' ✓' : ''}`}
                  </text>
                  {corners.map(([mode, hx, hy]) => (
                    <rect
                      key={mode}
                      x={hx - hs}
                      y={hy - hs}
                      width={hs * 2}
                      height={hs * 2}
                      fill={stroke}
                      stroke="#141414"
                      strokeWidth={1.5 / viewport.zoom}
                      className="pointer-events-auto"
                      style={{ cursor: mode === 'nw' || mode === 'se' ? 'nwse-resize' : 'nesw-resize' }}
                      onMouseDown={(e) => beginRegionDrag(e, i, mode)}
                    />
                  ))}
                </g>
              );
            })}

            {activeClip.transform.perspectivePin ? (
              <g>
                <polygon
                  points={`${renderedPc.x0},${renderedPc.y0} ${renderedPc.x1},${renderedPc.y1} ${renderedPc.x2},${renderedPc.y2} ${renderedPc.x3},${renderedPc.y3}`}
                  fill="transparent"
                  stroke="#fbbf24"
                  strokeWidth={1.5 / viewport.zoom}
                  className="pointer-events-auto cursor-move focus:outline-none"
                  onMouseDown={(e) => handleMouseDown(e, 'move')}
                  role="button"
                  aria-label="Move perspective pinned clip"
                />
                
                {([0, 1, 2, 3] as const).map((idx) => {
                  const cx = renderedPc[`x${idx}` as keyof typeof renderedPc];
                  const cy = renderedPc[`y${idx}` as keyof typeof renderedPc];
                  return (
                    <circle
                      key={`corner-${idx}`}
                      cx={cx}
                      cy={cy}
                      r={7 / viewport.zoom}
                      fill="#fbbf24"
                      stroke="#141414"
                      strokeWidth={1.5 / viewport.zoom}
                      className="pointer-events-auto cursor-crosshair focus:outline-none focus:stroke-white focus:stroke-2"
                      role="button"
                      tabIndex={0}
                      aria-label={`Perspective corner ${idx + 1}`}
                      onMouseDown={(e) => handleCornerMouseDown(e, idx)}
                      onKeyDown={(e) => handleCornerKeyDown(e, idx)}
                    />
                  );
                })}
              </g>
            ) : (
              <g
                transform={
                  // A Hybrid kinetic sentence measures its box from its PiP word
                  // layers, whose stored positions ALREADY include the container's
                  // x/y and scale (the canvas renderer does not apply a parent
                  // transform to PiP children, so the reflow has to bake it in).
                  //
                  // Applying that transform again here is what made the box creep
                  // off the text and shrink a little more with every drag — the
                  // error compounded because each drag re-measured the previous,
                  // already-doubly-transformed result.
                  // The kinetic box is offset by its measured local centre (the
                  // words are rarely centred exactly on the origin), then given
                  // the SAME transform as any other clip — so it rotates and
                  // scales with the sentence instead of only translating.
                  isKineticSentenceBox
                    ? `translate(${W / 2 + aX}, ${H / 2 + aY}) rotate(${aRot}) scale(${aScale / 100}) translate(${kineticBoxCentre.x}, ${kineticBoxCentre.y})`
                    : `translate(${W / 2 + aX}, ${H / 2 + aY}) rotate(${aRot}) scale(${aScale / 100})`
                }
              >
                {activePropertiesTab === 'mask' && mask.enabled ? (
                  <g transform={`translate(${maskLocalX}, ${maskLocalY}) rotate(${maskRot})`}>
                    {mask.type === 'rectangle' && (
                      <rect
                        x={-maskLocalW / 2}
                        y={-maskLocalH / 2}
                        width={maskLocalW}
                        height={maskLocalH}
                        rx={(mask.roundness || 0) / 100 * Math.min(maskLocalW, maskLocalH) / 2}
                        ry={(mask.roundness || 0) / 100 * Math.min(maskLocalW, maskLocalH) / 2}
                        fill="none"
                        stroke="#00d4ff"
                        strokeWidth={2 / viewport.zoom}
                        strokeDasharray="4,4"
                      />
                    )}
                    
                    {mask.type === 'circle' && (
                      <ellipse
                        cx={0}
                        cy={0}
                        rx={maskLocalW / 2}
                        ry={maskLocalH / 2}
                        fill="none"
                        stroke="#00d4ff"
                        strokeWidth={2 / viewport.zoom}
                        strokeDasharray="4,4"
                      />
                    )}
                    
                    {mask.type === 'split' && (
                      <>
                        <line
                          x1={-baseW * 5}
                          y1={0}
                          x2={baseW * 5}
                          y2={0}
                          stroke="#00d4ff"
                          strokeWidth={2 / viewport.zoom}
                          strokeDasharray="4,4"
                        />
                        <rect
                          x={-baseW * 5}
                          y={0}
                          width={baseW * 10}
                          height={baseH * 5}
                          fill="rgba(0, 212, 255, 0.07)"
                          style={{ pointerEvents: 'none' }}
                        />
                      </>
                    )}
                    
                    {mask.type === 'filmstrip' && (
                      <>
                        <line
                          x1={-baseW * 5}
                          y1={-maskLocalH / 2}
                          x2={baseW * 5}
                          y2={-maskLocalH / 2}
                          stroke="#00d4ff"
                          strokeWidth={2 / viewport.zoom}
                          strokeDasharray="4,4"
                        />
                        <line
                          x1={-baseW * 5}
                          y1={maskLocalH / 2}
                          x2={baseW * 5}
                          y2={maskLocalH / 2}
                          stroke="#00d4ff"
                          strokeWidth={2 / viewport.zoom}
                          strokeDasharray="4,4"
                        />
                        <rect
                          x={-baseW * 5}
                          y={-maskLocalH / 2}
                          width={baseW * 10}
                          height={maskLocalH}
                          fill="rgba(0, 212, 255, 0.07)"
                          style={{ pointerEvents: 'none' }}
                        />
                      </>
                    )}
                    
                    {mask.type === 'heart' && (
                      <path
                        d={getHeartPathData(-maskLocalW / 2, -maskLocalH / 2, maskLocalW, maskLocalH)}
                        fill="none"
                        stroke="#00d4ff"
                        strokeWidth={2 / viewport.zoom}
                        strokeDasharray="4,4"
                      />
                    )}
                    
                    {mask.type === 'star' && (
                      <polygon
                        points={getStarPointsData(0, 0, 5, maskLocalW / 2, maskLocalW / 4)}
                        fill="none"
                        stroke="#00d4ff"
                        strokeWidth={2 / viewport.zoom}
                        strokeDasharray="4,4"
                      />
                    )}

                    <circle
                      cx={0}
                      cy={0}
                      r={7 / viewport.zoom}
                      fill="#00d4ff"
                      stroke="white"
                      strokeWidth={1.5 / viewport.zoom}
                      className="pointer-events-auto cursor-move"
                      onMouseDown={(e) => handleMouseDown(e, 'mask-move')}
                    />

                    <line
                      x1={0}
                      y1={0}
                      x2={0}
                      y2={-maskLocalH / 2 - 30 / viewport.zoom}
                      stroke="#00d4ff"
                      strokeWidth={1.5 / viewport.zoom}
                    />
                    <circle
                      cx={0}
                      cy={-maskLocalH / 2 - 34 / viewport.zoom}
                      r={6 / viewport.zoom}
                      fill="#ffd700"
                      stroke="white"
                      strokeWidth={1.5 / viewport.zoom}
                      className="pointer-events-auto cursor-alias"
                      onMouseDown={(e) => handleMouseDown(e, 'mask-rot')}
                    />

                    {(mask.type === 'rectangle' || mask.type === 'circle' || mask.type === 'heart' || mask.type === 'star') && (
                      <>
                        <circle
                          cx={maskLocalW / 2}
                          cy={0}
                          r={6 / viewport.zoom}
                          fill="white"
                          stroke="#00d4ff"
                          strokeWidth={1.5 / viewport.zoom}
                          className="pointer-events-auto cursor-ew-resize"
                          onMouseDown={(e) => handleMouseDown(e, 'mask-resize-r')}
                        />
                        <circle
                          cx={-maskLocalW / 2}
                          cy={0}
                          r={6 / viewport.zoom}
                          fill="white"
                          stroke="#00d4ff"
                          strokeWidth={1.5 / viewport.zoom}
                          className="pointer-events-auto cursor-ew-resize"
                          onMouseDown={(e) => handleMouseDown(e, 'mask-resize-r')}
                        />
                      </>
                    )}

                    {(mask.type === 'rectangle' || mask.type === 'filmstrip') && (
                      <>
                        <circle
                          cx={0}
                          cy={-maskLocalH / 2}
                          r={6 / viewport.zoom}
                          fill="white"
                          stroke="#00d4ff"
                          strokeWidth={1.5 / viewport.zoom}
                          className="pointer-events-auto cursor-ns-resize"
                          onMouseDown={(e) => handleMouseDown(e, 'mask-resize-b')}
                        />
                        <circle
                          cx={0}
                          cy={maskLocalH / 2}
                          r={6 / viewport.zoom}
                          fill="white"
                          stroke="#00d4ff"
                          strokeWidth={1.5 / viewport.zoom}
                          className="pointer-events-auto cursor-ns-resize"
                          onMouseDown={(e) => handleMouseDown(e, 'mask-resize-b')}
                        />
                      </>
                    )}

                    <g transform={`translate(${mask.type === 'split' ? 50 / viewport.zoom : maskLocalW / 2 + 15 / viewport.zoom}, 0)`}>
                      <polygon
                        points="0,-4 8,0 0,4"
                        fill="#ff6b6b"
                        className="pointer-events-auto cursor-pointer"
                        onMouseDown={(e) => handleMouseDown(e, 'mask-feather')}
                        transform={`translate(${(mask.feather / 100) * Math.min(baseW, baseH) / 2}, 0)`}
                      />
                      <line
                        x1={0}
                        y1={0}
                        x2={50 / viewport.zoom}
                        y2={0}
                        stroke="#ff6b6b"
                        strokeWidth={1.5 / viewport.zoom}
                        strokeDasharray="2,2"
                        opacity={0.6}
                      />
                    </g>
                    


                    {mask.type === 'rectangle' && (
                      <circle
                        cx={-maskLocalW / 2 + (mask.roundness || 0) / 100 * maskLocalW / 2}
                        cy={-maskLocalH / 2 + (mask.roundness || 0) / 100 * maskLocalH / 2}
                        r={5 / viewport.zoom}
                        fill="#9b59b6"
                        stroke="white"
                        strokeWidth={1.5 / viewport.zoom}
                        className="pointer-events-auto cursor-nwse-resize"
                        onMouseDown={(e) => handleMouseDown(e, 'mask-roundness')}
                      />
                    )}
                  </g>
                ) : (
                  <rect
                    x={-baseW / 2}
                    y={-baseH / 2}
                    width={baseW}
                    height={baseH}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth={1.5 / viewport.zoom}
                    className="pointer-events-none"
                  />
                )}

                {maskDataUrl && (
                  <image
                    href={maskDataUrl}
                    x={-baseW / 2}
                    y={-baseH / 2}
                    width={baseW}
                    height={baseH}
                    className="pointer-events-none"
                  />
                )}

                {selectionPath.length > 1 && (
                  <polygon
                    points={getRenderedSelectionPoints()}
                    fill="rgba(255, 0, 255, 0.15)"
                    stroke="#ff00ff"
                    strokeWidth={1.5 / viewport.zoom}
                    strokeDasharray="4,4"
                    className="marching-ants pointer-events-none"
                  />
                )}

                {imageEditorTool !== 'none' && (
                  <rect
                    x={-baseW / 2}
                    y={-baseH / 2}
                    width={baseW}
                    height={baseH}
                    fill="rgba(0,0,0,0.01)"
                    className="pointer-events-auto cursor-crosshair focus:outline-none"
                    onPointerDown={handleEditorPointerDown}
                    onPointerMove={handleEditorPointerMove}
                    onPointerUp={handleEditorPointerUp}
                    onPointerCancel={handleEditorPointerUp}
                  />
                )}

                {/* Hidden while a motion region is being placed: the two overlays
                    would otherwise overlap and a drag meant for the region box
                    would move the whole clip instead. */}
                {regionEditActive ? null : activePropertiesTab === 'mask' && mask.enabled ? null : imageEditorTool !== 'none' ? null : canvasTransformMode === 'resize' ? (
                  <>
                    {/* Move bounding box (transparent, captures pointer for moving) */}
                    <rect
                      x={-baseW / 2}
                      y={-baseH / 2}
                      width={baseW}
                      height={baseH}
                      fill="transparent"
                      className="pointer-events-auto cursor-move focus:outline-none focus:stroke-white focus:stroke-2"
                      style={{ touchAction: 'none' }}
                      role="button"
                      tabIndex={0}
                      aria-label="Move clip"
                      onMouseDown={(e) => handleMouseDown(e, 'move')}
                      onTouchStart={(e) => handleMouseDown(e, 'move')}
                      onKeyDown={(e) => handleHandleKeyDown(e, 'move')}
                    />

                    {/* Dashed rotation arc connecting the rotation handle to the top edge */}
                    <path
                      d={`M ${-baseW / 4},${-baseH / 2} A ${baseW / 4},${baseW / 4} 0 0 1 ${baseW / 4},${-baseH / 2}`}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth={1.5 / viewport.zoom}
                      strokeDasharray="4 3"
                      opacity={0.7}
                      className="pointer-events-none"
                    />

                    {/* Rotation handle line + circle */}
                    <line
                      x1={0}
                      y1={-baseH / 2}
                      x2={0}
                      y2={-baseH / 2 - 24 / viewport.zoom}
                      stroke="#fbbf24"
                      strokeWidth={1.5 / viewport.zoom}
                    />
                    <circle
                      cx={0}
                      cy={-baseH / 2 - 28 / viewport.zoom}
                      r={6 / viewport.zoom}
                      fill="#fbbf24"
                      stroke="#141414"
                      strokeWidth={1.5 / viewport.zoom}
                      className="pointer-events-auto cursor-alias focus:outline-none focus:stroke-white focus:stroke-2"
                      style={{ touchAction: 'none' }}
                      role="button"
                      tabIndex={0}
                      aria-label="Rotate clip"
                      onMouseDown={(e) => handleMouseDown(e, 'rot')}
                      onTouchStart={(e) => handleMouseDown(e, 'rot')}
                      onKeyDown={(e) => handleHandleKeyDown(e, 'rot')}
                    >
                      <title>Rotate</title>
                    </circle>

                    {/* Center crosshair (helps identify clip center for snapping) */}
                    <g className="pointer-events-none" opacity={0.65}>
                      <line x1={-6 / viewport.zoom} y1={0} x2={6 / viewport.zoom} y2={0} stroke="#fbbf24" strokeWidth={1 / viewport.zoom} />
                      <line x1={0} y1={-6 / viewport.zoom} x2={0} y2={6 / viewport.zoom} stroke="#fbbf24" strokeWidth={1 / viewport.zoom} />
                    </g>

                    {/* Edge mid-handles (N, S, E, W) */}
                    {[
                      { dir: 't', cx: 0, cy: -baseH / 2, cursor: 'ns-resize' },
                      { dir: 'b', cx: 0, cy: baseH / 2, cursor: 'ns-resize' },
                      { dir: 'l', cx: -baseW / 2, cy: 0, cursor: 'ew-resize' },
                      { dir: 'r', cx: baseW / 2, cy: 0, cursor: 'ew-resize' },
                    ].map(({ dir, cx: hx, cy: hy, cursor }) => {
                      const isHoriz = dir === 't' || dir === 'b';
                      const w = isHoriz ? 14 / viewport.zoom : 6 / viewport.zoom;
                      const h = isHoriz ? 6 / viewport.zoom : 14 / viewport.zoom;
                      return (
                        <rect
                          key={`edge-${dir}`}
                          x={hx - w / 2}
                          y={hy - h / 2}
                          width={w}
                          height={h}
                          rx={2 / viewport.zoom}
                          fill="#fbbf24"
                          stroke="#141414"
                          strokeWidth={1.5 / viewport.zoom}
                          className="pointer-events-auto focus:outline-none focus:stroke-white focus:stroke-2"
                          style={{ cursor, touchAction: 'none' }}
                          role="button"
                          tabIndex={0}
                          aria-label={`Resize edge ${dir.toUpperCase()}`}
                          onMouseDown={(e) => handleMouseDown(e, `resize-${dir}`)}
                          onTouchStart={(e) => handleMouseDown(e, `resize-${dir}`)}
                          onKeyDown={(e) => handleHandleKeyDown(e, `resize-${dir}`)}
                        />
                      );
                    })}

                    {/* Corner handles (TL, TR, BL, BR) */}
                    {[-1, 1].map((rx) =>
                      [-1, 1].map((ry) => (
                        <rect
                          key={`${rx}-${ry}`}
                          x={(rx * baseW) / 2 - 6 / viewport.zoom}
                          y={(ry * baseH) / 2 - 6 / viewport.zoom}
                          width={12 / viewport.zoom}
                          height={12 / viewport.zoom}
                          rx={2 / viewport.zoom}
                          fill="#fbbf24"
                          stroke="#141414"
                          strokeWidth={1.5 / viewport.zoom}
                          className="pointer-events-auto focus:outline-none focus:stroke-white focus:stroke-2"
                          style={{
                            cursor: rx === ry ? 'nwse-resize' : 'nesw-resize',
                            touchAction: 'none',
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`Resize handle ${rx > 0 ? 'right' : 'left'}-${ry > 0 ? 'bottom' : 'top'}`}
                          onMouseDown={(e) =>
                            handleMouseDown(e, `resize-${rx > 0 ? 'r' : 'l'}${ry > 0 ? 'b' : 't'}`)
                          }
                          onTouchStart={(e) =>
                            handleMouseDown(e, `resize-${rx > 0 ? 'r' : 'l'}${ry > 0 ? 'b' : 't'}`)
                          }
                          onKeyDown={(e) =>
                            handleHandleKeyDown(e, `resize-${rx > 0 ? 'r' : 'l'}${ry > 0 ? 'b' : 't'}`)
                          }
                        />
                      )),
                    )}
                  </>
                ) : (
                  <>
                    <rect
                      x={-baseW / 2 + (aCropLeft / 100) * baseW}
                      y={-baseH / 2 + (aCropTop / 100) * baseH}
                      width={baseW * (1 - (aCropLeft + aCropRight) / 100)}
                      height={baseH * (1 - (aCropTop + aCropBot) / 100)}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth={2 / viewport.zoom}
                      strokeDasharray="4 4"
                      className="pointer-events-none"
                    />
                    <rect
                      x={-baseW / 2 + (aCropLeft / 100) * baseW - 6/viewport.zoom}
                      y={-baseH / 2 + (aCropTop / 100) * baseH + (baseH * (1 - (aCropTop + aCropBot) / 100)) / 2 - 10/viewport.zoom}
                      width={12/viewport.zoom}
                      height={20/viewport.zoom}
                      fill="#3b82f6"
                      className="pointer-events-auto cursor-ew-resize focus:outline-none focus:stroke-white focus:stroke-2"
                      style={{ touchAction: 'none' }}
                      role="button"
                      tabIndex={0}
                      aria-label="Crop Left"
                      onMouseDown={(e) => handleMouseDown(e, 'crop-left')}
                      onTouchStart={(e) => handleMouseDown(e, 'crop-left')}
                      onKeyDown={(e) => handleHandleKeyDown(e, 'crop-left')}
                    />
                    <rect
                      x={-baseW / 2 + baseW - (aCropRight / 100) * baseW - 6/viewport.zoom}
                      y={-baseH / 2 + (aCropTop / 100) * baseH + (baseH * (1 - (aCropTop + aCropBot) / 100)) / 2 - 10/viewport.zoom}
                      width={12/viewport.zoom}
                      height={20/viewport.zoom}
                      fill="#3b82f6"
                      className="pointer-events-auto cursor-ew-resize focus:outline-none focus:stroke-white focus:stroke-2"
                      style={{ touchAction: 'none' }}
                      role="button"
                      tabIndex={0}
                      aria-label="Crop Right"
                      onMouseDown={(e) => handleMouseDown(e, 'crop-right')}
                      onTouchStart={(e) => handleMouseDown(e, 'crop-right')}
                      onKeyDown={(e) => handleHandleKeyDown(e, 'crop-right')}
                    />
                    <rect
                      x={-baseW / 2 + (aCropLeft / 100) * baseW + (baseW * (1 - (aCropLeft + aCropRight) / 100)) / 2 - 10/viewport.zoom}
                      y={-baseH / 2 + (aCropTop / 100) * baseH - 6/viewport.zoom}
                      width={20/viewport.zoom}
                      height={12/viewport.zoom}
                      fill="#3b82f6"
                      className="pointer-events-auto cursor-ns-resize focus:outline-none focus:stroke-white focus:stroke-2"
                      style={{ touchAction: 'none' }}
                      role="button"
                      tabIndex={0}
                      aria-label="Crop Top"
                      onMouseDown={(e) => handleMouseDown(e, 'crop-top')}
                      onTouchStart={(e) => handleMouseDown(e, 'crop-top')}
                      onKeyDown={(e) => handleHandleKeyDown(e, 'crop-top')}
                    />
                    <rect
                      x={-baseW / 2 + (aCropLeft / 100) * baseW + (baseW * (1 - (aCropLeft + aCropRight) / 100)) / 2 - 10/viewport.zoom}
                      y={-baseH / 2 + baseH - (aCropBot / 100) * baseH - 6/viewport.zoom}
                      width={20/viewport.zoom}
                      height={12/viewport.zoom}
                      fill="#3b82f6"
                      className="pointer-events-auto cursor-ns-resize focus:outline-none focus:stroke-white focus:stroke-2"
                      style={{ touchAction: 'none' }}
                      role="button"
                      tabIndex={0}
                      aria-label="Crop Bottom"
                      onMouseDown={(e) => handleMouseDown(e, 'crop-bottom')}
                      onTouchStart={(e) => handleMouseDown(e, 'crop-bottom')}
                      onKeyDown={(e) => handleHandleKeyDown(e, 'crop-bottom')}
                    />
                  </>
                )}
              </g>
            )}
            
            {/* Smart Guides */}
            {snapGuides.map((g, i) => (
              <line
                key={`guide-${i}`}
                x1={g.axis === 'x' ? W/2 + g.position : 0}
                y1={g.axis === 'y' ? H/2 + g.position : 0}
                x2={g.axis === 'x' ? W/2 + g.position : W}
                y2={g.axis === 'y' ? H/2 + g.position : H}
                stroke="#ff00ff"
                strokeWidth={1/viewport.zoom}
                strokeDasharray="4,4"
              />
            ))}
          </g>

          <g transform={`translate(${totalX - viewport.x}, ${totalY - viewport.y})`}>
            {renderVirtualCamera()}
          </g>
          
          <defs>
            <style>{`
              @keyframes marching-ants {
                0% { stroke-dashoffset: 0; }
                100% { stroke-dashoffset: -8; }
              }
              .marching-ants {
                animation: marching-ants 0.4s linear infinite;
              }
            `}</style>
          </defs>
        </svg>
      </div>

      {/* Floating Picture Editor Toolbar */}
      {mediaItem?.type === 'image' && (
        <div
          className="absolute top-1/2 -translate-y-1/2 right-0 z-50 pointer-events-auto select-none flex items-stretch"
          style={{ right: 0 }}
        >
          <div
            className={`flex flex-col bg-[#141414]/95 backdrop-blur-md border border-[#3e3e3e] border-r-0 rounded-l-xl shadow-2xl overflow-y-auto overflow-x-hidden max-h-[90vh] custom-scrollbar transition-all duration-200 ${
              imageEditorTool !== 'none' || true ? 'w-[90px]' : 'w-0 opacity-0'
            }`}
          >
            {/* SELECTION TOOLS */}
            <div className="px-2 pt-2 pb-1">
              <span className="block text-center text-[8px] font-bold text-[#6a6a6a] uppercase tracking-widest mb-1.5">Select</span>

              <button
                onClick={() => {
                  setImageEditorTool(imageEditorTool === 'magic' ? 'none' : 'magic');
                  setSelectionPath([]);
                  setSelectionMask(null);
                }}
                className={`w-full flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg mb-1 transition-all ${
                  imageEditorTool === 'magic'
                    ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50'
                    : 'text-[#c0c0c0] hover:bg-[#252525] hover:text-white'
                }`}
                title="Magic Wand – auto-select region by color"
              >
                <Wand2 className="w-4 h-4" />
                <span className="text-[9px] font-medium leading-none">Magic</span>
              </button>

              <button
                onClick={() => {
                  setImageEditorTool(imageEditorTool === 'lasso' ? 'none' : 'lasso');
                  setSelectionPath([]);
                  setSelectionMask(null);
                }}
                className={`w-full flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg mb-1 transition-all ${
                  imageEditorTool === 'lasso'
                    ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50'
                    : 'text-[#c0c0c0] hover:bg-[#252525] hover:text-white'
                }`}
                title="Lasso – draw freehand selection"
              >
                <Scissors className="w-4 h-4" />
                <span className="text-[9px] font-medium leading-none">Lasso</span>
              </button>

              <button
                onClick={() => {
                  setImageEditorTool(imageEditorTool === 'poly' ? 'none' : 'poly');
                  setSelectionPath([]);
                  setSelectionMask(null);
                }}
                className={`w-full flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg transition-all ${
                  imageEditorTool === 'poly'
                    ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50'
                    : 'text-[#c0c0c0] hover:bg-[#252525] hover:text-white'
                }`}
                title="Polygon – click points to draw polygon"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3 8 5-3 10-10 3L3 11Z"/></svg>
                <span className="text-[9px] font-medium leading-none">Polygon</span>
              </button>

              {(selectionPath.length > 0 || selectionMask) && (
                <button
                  onClick={() => { setSelectionPath([]); setSelectionMask(null); }}
                  className="w-full flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg mt-1 text-red-400 hover:bg-red-500/10 transition-all"
                  title="Clear selection"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-medium leading-none">Clear</span>
                </button>
              )}
            </div>

            <div className="h-px bg-[#2e2e2e] mx-2 my-0.5" />

            {/* ACTION TOOLS */}
            <div className="px-2 pt-1 pb-2">
              <span className="block text-center text-[8px] font-bold text-[#6a6a6a] uppercase tracking-widest mb-1.5">Action</span>

              <button
                onClick={() => applyEditorAction('delete')}
                disabled={selectionPath.length === 0 && !selectionMask}
                className="w-full flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg mb-1 bg-red-600/80 hover:bg-red-500 disabled:bg-[#252525] disabled:text-[#555] text-white transition-all"
                title="Delete – fill selection with black"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/></svg>
                <span className="text-[9px] font-medium leading-none">Delete</span>
              </button>

              <button
                onClick={() => applyEditorAction('remove')}
                disabled={selectionPath.length === 0 && !selectionMask}
                className="w-full flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg mb-1 bg-gradient-to-b from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 disabled:from-[#252525] disabled:to-[#252525] disabled:text-[#555] text-white transition-all"
                title="Remove – AI object removal (inpainting)"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="text-[9px] font-medium leading-none">Remove</span>
              </button>

              <button
                onClick={() => applyEditorAction('erase')}
                disabled={selectionPath.length === 0 && !selectionMask}
                className="w-full flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg bg-purple-700/80 hover:bg-purple-600 disabled:bg-[#252525] disabled:text-[#555] text-white transition-all"
                title="Erase – make selection transparent"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span className="text-[9px] font-medium leading-none">Erase</span>
              </button>
            </div>

            <div className="h-px bg-[#2e2e2e] mx-2 my-0.5" />

            {/* TRANSFORM TOOLS */}
            <div className="px-2 pt-1 pb-2">
              <span className="block text-center text-[8px] font-bold text-[#6a6a6a] uppercase tracking-widest mb-1.5">Canvas</span>
              <button
                className={`w-full flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg mb-1 transition-all ${
                  canvasTransformMode === 'resize'
                    ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50'
                    : 'text-[#c0c0c0] hover:bg-[#252525] hover:text-white'
                }`}
                onClick={(e) => { e.stopPropagation(); setCanvasTransformMode('resize'); setImageEditorTool('none'); }}
                title="Transform Mode"
              >
                <Maximize2 className="w-4 h-4" />
                <span className="text-[9px] font-medium leading-none">Move</span>
              </button>
              <button
                className={`w-full flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg transition-all ${
                  canvasTransformMode === 'crop'
                    ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50'
                    : 'text-[#c0c0c0] hover:bg-[#252525] hover:text-white'
                }`}
                onClick={(e) => { e.stopPropagation(); setCanvasTransformMode('crop'); setImageEditorTool('none'); }}
                title="Crop Mode"
              >
                <Scissors className="w-4 h-4" />
                <span className="text-[9px] font-medium leading-none">Crop</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {mediaItem?.type !== 'image' && (
        <div className="absolute top-4 right-4 bg-[#252525] border border-[#3e3e3e] rounded flex flex-col overflow-hidden shadow-lg pointer-events-auto z-10">
          <button
            className={`p-2 transition-colors ${
              canvasTransformMode === 'resize' ? 'bg-[#3e3e3e] text-amber-500' : 'text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]'
            }`}
            onClick={(e) => { e.stopPropagation(); setCanvasTransformMode('resize'); }}
            title="Transform Mode"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            className={`p-2 transition-colors ${
              canvasTransformMode === 'crop' ? 'bg-[#3e3e3e] text-amber-500' : 'text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]'
            }`}
            onClick={(e) => { e.stopPropagation(); setCanvasTransformMode('crop'); }}
            title="Crop Mode"
          >
            <Scissors className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}
