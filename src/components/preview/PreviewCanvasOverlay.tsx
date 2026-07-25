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
import { getClipDimensions, inpaint } from './previewMath';

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
  const currentTime = useEditorStore(s => s.currentTime);
  const selectedClipId = useEditorStore(s => s.selectedClipId);
  const canvasTransformMode = useEditorStore(s => s.canvasTransformMode);
  const setCanvasTransformMode = useEditorStore(s => s.setCanvasTransformMode);
  const aspectRatio = useEditorStore(s => s.aspectRatio);
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
    initMask?: any;
    initVirtualCamera?: { x: number; y: number };
  } | null>(null);
  
  const [snapGuides, setSnapGuides] = useState<{axis: 'x'|'y', position: number}[]>([]);

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

  const aX = activeClip ? getAnimatedValue(activeClip.transform.x, currentTime, activeClip.startTime, activeClip.animations?.['transform.x']) : 0;
  const aY = activeClip ? getAnimatedValue(activeClip.transform.y, currentTime, activeClip.startTime, activeClip.animations?.['transform.y']) : 0;
  const aScale = activeClip ? getAnimatedValue(activeClip.transform.scale, currentTime, activeClip.startTime, activeClip.animations?.['transform.scale']) : 100;
  const aRot = activeClip ? getAnimatedValue(activeClip.transform.rotation, currentTime, activeClip.startTime, activeClip.animations?.['transform.rotation']) : 0;

  const aCropLeft = activeClip ? getAnimatedValue(activeClip.crop?.left || 0, currentTime, activeClip.startTime, activeClip.animations?.['crop.left']) : 0;
  const aCropTop = activeClip ? getAnimatedValue(activeClip.crop?.top || 0, currentTime, activeClip.startTime, activeClip.animations?.['crop.top']) : 0;
  const aCropRight = activeClip ? getAnimatedValue(activeClip.crop?.right || 0, currentTime, activeClip.startTime, activeClip.animations?.['crop.right']) : 0;
  const aCropBot = activeClip ? getAnimatedValue(activeClip.crop?.bottom || 0, currentTime, activeClip.startTime, activeClip.animations?.['crop.bottom']) : 0;

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
    const handleMove = (e: MouseEvent) => {
      const container = document.getElementById('preview-canvas-wrapper');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const scaleX = 854 / rect.width;
      const scaleY = 480 / rect.height;

      const dx = ((e.clientX - dragState.startX) * scaleX) / viewport.zoom;
      const dy = ((e.clientY - dragState.startY) * scaleY) / viewport.zoom;

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
            const clientXLocal = (e.clientX - rect.left) * scaleX - (427 + aX);
            const clientYLocal = (e.clientY - rect.top) * scaleY - (240 + aY);
            
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
            const clientXLocal = (e.clientX - rect.left) * scaleX - (427 + aX);
            const clientYLocal = (e.clientY - rect.top) * scaleY - (240 + aY);
            
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
            const clientXLocal = (e.clientX - rect.left) * scaleX - (427 + aX);
            const clientYLocal = (e.clientY - rect.top) * scaleY - (240 + aY);
            
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
            const clientXLocal = (e.clientX - rect.left) * scaleX - (427 + aX);
            const clientYLocal = (e.clientY - rect.top) * scaleY - (240 + aY);
            
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
            const clientXLocal = (e.clientX - rect.left) * scaleX - (427 + aX);
            const clientYLocal = (e.clientY - rect.top) * scaleY - (240 + aY);
            
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

        const newGuides: { axis: 'x' | 'y'; position: number }[] = [];
        const snapThreshold = 12;

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

        let W = 854;
        let H = 480;

        const targetsX = [
          -W / 2,
          0,
          W / 2
        ];

        otherActiveClips.forEach((other) => {
          const dims = getClipDimensions(other, mediaLibrary, W, H);
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
            if (diff < snapThreshold && diff < minDiffX) {
              minDiffX = diff;
              if (anchor.type === 'left') {
                bestSnapX = targetVal + draggedWidth / 2;
              } else if (anchor.type === 'center') {
                bestSnapX = targetVal;
              } else {
                bestSnapX = targetVal - draggedWidth / 2;
              }
              snapXVal = targetVal;
            }
          });
        });

        if (bestSnapX !== null) {
          newX = bestSnapX;
          if (snapXVal !== null) {
            newGuides.push({ axis: 'x', position: snapXVal });
          }
        }

        let bestSnapY: number | null = null;
        let minDiffY = Infinity;
        let snapYVal: number | null = null;

        const targetsY = [
          -H / 2,
          0,
          H / 2
        ];

        otherActiveClips.forEach((other) => {
          const dims = getClipDimensions(other, mediaLibrary, W, H);
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
            if (diff < snapThreshold && diff < minDiffY) {
              minDiffY = diff;
              if (anchor.type === 'top') {
                bestSnapY = targetVal + draggedHeight / 2;
              } else if (anchor.type === 'center') {
                bestSnapY = targetVal;
              } else {
                bestSnapY = targetVal - draggedHeight / 2;
              }
              snapYVal = targetVal;
            }
          });
        });

        if (bestSnapY !== null) {
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
        const theta = (-rotation * Math.PI) / 180;
        const localDx = (dx * Math.cos(theta) - dy * Math.sin(theta)) / (scale / 100);
        const localDy = (dx * Math.sin(theta) + dy * Math.cos(theta)) / (scale / 100);

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
        const cx = 427 + x;
        const cy = 240 + y;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;
        let angle = Math.atan2(my - cy, mx - cx) * (180 / Math.PI);
        angle += 90;
        rotation = Math.round(angle);
        getNewAnimations('transform.rotation', rotation);
      } else {
        const cx = 427 + x;
        const cy = 240 + y;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;
        const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
        
        const wSpan = baseW * (1 - (crop.left + crop.right) / 100) / 2;
        const hSpan = baseH * (1 - (crop.top + crop.bottom) / 100) / 2;
        
        const origDist = Math.sqrt(wSpan ** 2 + hSpan ** 2) * (dragState.initTransform.scale / 100);
        const scaleDelta = dist / origDist;
        scale = dragState.initTransform.scale * scaleDelta;
        scale = Math.max(10, Math.min(1000, Math.round(scale)));
        getNewAnimations('transform.scale', scale);
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
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragState, activeClip, updateClip, mediaItem, videoElements, viewport, currentTime, aspectRatio]);

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
        publicPath: 'https://static.imgly.com/@imgly/background-removal-data/1.4.0/dist/',
        progress: (key: string, current: number, total: number) => {}
      });

      const resultImg = new Image();
      const resultUrl = URL.createObjectURL(resultBlob);
      await new Promise((resolve, reject) => {
        resultImg.onload = () => {
          URL.revokeObjectURL(resultUrl);
          resolve(null);
        };
        resultImg.onerror = (e) => {
          URL.revokeObjectURL(resultUrl);
          reject(e);
        };
        resultImg.src = resultUrl;
      });

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
    let imageW = 1920;
    let imageH = 1080;
    const img = getCachedImage(mediaItem.id, mediaItem.url as string, () => {});
    if (img && img.naturalWidth > 0) {
      imageW = img.naturalWidth;
      imageH = img.naturalHeight;
    }

    let vw = 854;
    let vh = 480;
    if (mediaItem?.type === 'video' || mediaItem?.type === 'image') {
      vw = 1920;
      vh = 1080;
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
    return canvas.toDataURL();
  }, [selectionMask, mediaItem]);

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

  let vw = 1920;
  let vh = 1080;
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
    if (ts) {
      const fontSize = Number(ts.fontSize) || 48;
      const text = String(ts.text || '');
      const lines = text.split('\n');
      const estCharWidth = fontSize * 0.6;
      const longestLine = lines.reduce((max, l) => Math.max(max, l.length), 0);
      vw = Math.max(80, longestLine * estCharWidth + 40);
      vh = lines.length * (fontSize * 1.35) + 20;
    } else {
      vw = 300;
      vh = 80;
    }
  }

  let scaleToFit = 1;
  if (mediaItem?.type === 'video' || mediaItem?.type === 'image') {
    scaleToFit = Math.min(W / vw, H / vh);
  }
  const baseW = vw * scaleToFit;
  const baseH = vh * scaleToFit;

  const handleMouseDown = (e: React.MouseEvent, type: string) => {
    e.stopPropagation();
    const mask = activeClip?.mask || { x: 50, y: 50, width: 50, height: 50, rotation: 0, feather: 0, roundness: 0 };
    setDragState({
      type,
      startX: e.clientX,
      startY: e.clientY,
      initTransform: { x: aX, y: aY, scale: aScale, rotation: aRot },
      initCrop: { left: aCropLeft, top: aCropTop, right: aCropRight, bottom: aCropBot },
      initMask: { ...mask },
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

  const handleCornerMouseDown = (e: React.MouseEvent, cornerIdx: number) => {
    e.stopPropagation();
    setDragState({
      type: `perspective-corner-${cornerIdx}`,
      startX: e.clientX,
      startY: e.clientY,
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
                transform={`translate(${W / 2 + aX}, ${H / 2 + aY}) rotate(${aRot}) scale(${aScale / 100})`}
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

                {activePropertiesTab === 'mask' && mask.enabled ? null : imageEditorTool !== 'none' ? null : canvasTransformMode === 'resize' ? (
                  <>
                    <rect
                      x={-baseW / 2}
                      y={-baseH / 2}
                      width={baseW}
                      height={baseH}
                      fill="transparent"
                      className="pointer-events-auto cursor-move focus:outline-none focus:stroke-white focus:stroke-2"
                      role="button"
                      tabIndex={0}
                      aria-label="Move clip"
                      onMouseDown={(e) => handleMouseDown(e, 'move')}
                      onKeyDown={(e) => handleHandleKeyDown(e, 'move')}
                    />
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
                      role="button"
                      tabIndex={0}
                      aria-label="Rotate clip"
                      onMouseDown={(e) => handleMouseDown(e, 'rot')}
                      onKeyDown={(e) => handleHandleKeyDown(e, 'rot')}
                    >
                      <title>Rotate</title>
                    </circle>
                    {[-1, 1].map((rx) =>
                      [-1, 1].map((ry) => (
                        <circle
                          key={`${rx}-${ry}`}
                          cx={(rx * baseW) / 2}
                          cy={(ry * baseH) / 2}
                          r={6 / viewport.zoom}
                          fill="#fbbf24"
                          stroke="#141414"
                          strokeWidth={1.5 / viewport.zoom}
                          className="pointer-events-auto focus:outline-none focus:stroke-white focus:stroke-2"
                          style={{
                            cursor: rx === ry ? 'nwse-resize' : 'nesw-resize',
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`Resize handle ${rx > 0 ? 'right' : 'left'}-${ry > 0 ? 'bottom' : 'top'}`}
                          onMouseDown={(e) =>
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
                      role="button"
                      tabIndex={0}
                      aria-label="Crop Left"
                      onMouseDown={(e) => handleMouseDown(e, 'crop-left')}
                      onKeyDown={(e) => handleHandleKeyDown(e, 'crop-left')}
                    />
                    <rect
                      x={-baseW / 2 + baseW - (aCropRight / 100) * baseW - 6/viewport.zoom}
                      y={-baseH / 2 + (aCropTop / 100) * baseH + (baseH * (1 - (aCropTop + aCropBot) / 100)) / 2 - 10/viewport.zoom}
                      width={12/viewport.zoom}
                      height={20/viewport.zoom}
                      fill="#3b82f6"
                      className="pointer-events-auto cursor-ew-resize focus:outline-none focus:stroke-white focus:stroke-2"
                      role="button"
                      tabIndex={0}
                      aria-label="Crop Right"
                      onMouseDown={(e) => handleMouseDown(e, 'crop-right')}
                      onKeyDown={(e) => handleHandleKeyDown(e, 'crop-right')}
                    />
                    <rect
                      x={-baseW / 2 + (aCropLeft / 100) * baseW + (baseW * (1 - (aCropLeft + aCropRight) / 100)) / 2 - 10/viewport.zoom}
                      y={-baseH / 2 + (aCropTop / 100) * baseH - 6/viewport.zoom}
                      width={20/viewport.zoom}
                      height={12/viewport.zoom}
                      fill="#3b82f6"
                      className="pointer-events-auto cursor-ns-resize focus:outline-none focus:stroke-white focus:stroke-2"
                      role="button"
                      tabIndex={0}
                      aria-label="Crop Top"
                      onMouseDown={(e) => handleMouseDown(e, 'crop-top')}
                      onKeyDown={(e) => handleHandleKeyDown(e, 'crop-top')}
                    />
                    <rect
                      x={-baseW / 2 + (aCropLeft / 100) * baseW + (baseW * (1 - (aCropLeft + aCropRight) / 100)) / 2 - 10/viewport.zoom}
                      y={-baseH / 2 + baseH - (aCropBot / 100) * baseH - 6/viewport.zoom}
                      width={20/viewport.zoom}
                      height={12/viewport.zoom}
                      fill="#3b82f6"
                      className="pointer-events-auto cursor-ns-resize focus:outline-none focus:stroke-white focus:stroke-2"
                      role="button"
                      tabIndex={0}
                      aria-label="Crop Bottom"
                      onMouseDown={(e) => handleMouseDown(e, 'crop-bottom')}
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
