import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Eraser,
  Check,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Sliders,
  Maximize2,
  HelpCircle,
  Wand2,
  Pipette,
  ScanSearch,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useShallow } from 'zustand/react/shallow';
import type {
  TimelineClip,
  ClipObjectRemovalSettings,
  ObjectRemovalMode,
  ObjectRemovalShape,
  WatermarkRegion,
  WatermarkColorProfileId,
} from '@/types';
import { applyObjectRemoval } from '@/utils/objectRemoval';
import {
  WATERMARK_PRESETS,
  WatermarkPreset,
  FAMOUS_WATERMARK_COLOR_PROFILES,
  detectWatermarkRegion,
  detectWatermarkWithAI,
  scanWatermarkColorInBox,
} from '@/utils/watermarkPresets';
import { toast } from 'sonner';

interface WatermarkRemoverModalProps {
  onClose: () => void;
}

export function WatermarkRemoverModal({ onClose }: WatermarkRemoverModalProps) {
  const {
    tracks,
    mediaLibrary,
    watermarkRemoverTargetClipId,
    selectedClipId,
    updateClip,
    saveSnapshot,
  } = useEditorStore(
    useShallow((s) => ({
      tracks: s.tracks,
      mediaLibrary: s.mediaLibrary,
      watermarkRemoverTargetClipId: s.watermarkRemoverTargetClipId,
      selectedClipId: s.selectedClipId,
      updateClip: s.updateClip,
      saveSnapshot: s.saveSnapshot,
    }))
  );

  // Find all available video / image clips in project
  const availableClips = useMemo(() => {
    const list: { clip: TimelineClip; trackName: string; mediaTitle: string }[] = [];
    tracks.forEach((track, tIdx) => {
      track.clips.forEach((clip) => {
        const media = mediaLibrary.find((m) => m.id === clip.mediaId);
        if (media?.type === 'video' || media?.type === 'image' || !media?.type) {
          list.push({
            clip,
            trackName: track.name || `Track ${tIdx + 1}`,
            mediaTitle: media?.name || clip.name || 'Untitled Clip',
          });
        }
      });
    });
    return list;
  }, [tracks, mediaLibrary]);

  // Initial target clip ID
  const [activeClipId, setActiveClipId] = useState<string>(() => {
    if (watermarkRemoverTargetClipId && availableClips.some((c) => c.clip.id === watermarkRemoverTargetClipId)) {
      return watermarkRemoverTargetClipId;
    }
    if (selectedClipId && availableClips.some((c) => c.clip.id === selectedClipId)) {
      return selectedClipId;
    }
    return availableClips[0]?.clip.id || '';
  });

  const activeClip = useMemo(() => {
    return availableClips.find((c) => c.clip.id === activeClipId)?.clip || null;
  }, [availableClips, activeClipId]);

  const activeMedia = useMemo(() => {
    if (!activeClip) return null;
    return mediaLibrary.find((m) => m.id === activeClip.mediaId) || null;
  }, [activeClip, mediaLibrary]);

  // Local working settings for the clip's watermark removal
  const [settings, setSettings] = useState<ClipObjectRemovalSettings>(() => {
    const initial = activeClip?.objectRemoval;
    if (initial && initial.enabled) {
      return {
        watermarkProfile: 'auto_smart',
        targetColor: '#FFFFFF',
        colorTolerance: 38,
        alphaUnblend: true,
        ...initial,
      };
    }
    return {
      enabled: true,
      mode: 'content_aware',
      shape: 'rectangle',
      x: 88,
      y: 88,
      width: 20,
      height: 12,
      rotation: 0,
      feather: 14,
      opacity: 100,
      stretchStrength: 85,
      patchSourceX: 30,
      patchSourceY: 30,
      watermarkProfile: 'auto_smart',
      targetColor: '#FFFFFF',
      colorTolerance: 38,
      alphaUnblend: true,
      showHighlight: true,
      temporalSmoothing: true,
      quality: 'preview',
      regions: [],
    };
  });

  // Track active region index (0 = primary box, >= 1 = additional regions)
  const [selectedRegionIndex, setSelectedRegionIndex] = useState<number>(0);

  // Playback & preview time inside the clip (in seconds, relative to clip start)
  const [clipTime, setClipTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showOriginal, setShowOriginal] = useState<boolean>(false);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [isPickingColor, setIsPickingColor] = useState<boolean>(false);
  const [scannedInfo, setScannedInfo] = useState<{
    detectedHex: string;
    estimatedOpacity: number;
    matchedProfileId: WatermarkColorProfileId;
    watermarkPixelRatio: number;
  } | null>(null);

  // Canvas and video element refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Interactive drag state on the video canvas overlay
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragHandle, setDragHandle] = useState<'move' | 'nw' | 'ne' | 'se' | 'sw' | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number; startW: number; startH: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
    startW: 0,
    startH: 0,
  });

  // When active clip changes, load its existing settings
  useEffect(() => {
    if (activeClip) {
      if (activeClip.objectRemoval && activeClip.objectRemoval.enabled) {
        setSettings({
          watermarkProfile: 'auto_smart',
          targetColor: '#FFFFFF',
          colorTolerance: 38,
          alphaUnblend: true,
          ...activeClip.objectRemoval,
        });
      } else {
        setSettings((prev) => ({
          ...prev,
          enabled: true,
        }));
      }
      setClipTime(0);
      setIsPlaying(false);
    }
  }, [activeClipId]);

  // Current active region parameters (either primary or from regions array)
  const currentRegion = useMemo(() => {
    if (selectedRegionIndex === 0 || !settings.regions || settings.regions.length < selectedRegionIndex) {
      return {
        id: 'primary',
        name: 'Primary Watermark',
        enabled: settings.enabled,
        mode: settings.mode,
        shape: settings.shape,
        x: settings.x,
        y: settings.y,
        width: settings.width,
        height: settings.height,
        rotation: settings.rotation,
        feather: settings.feather,
        opacity: settings.opacity,
        stretchStrength: settings.stretchStrength,
        patchSourceX: settings.patchSourceX,
        patchSourceY: settings.patchSourceY,
        watermarkProfile: settings.watermarkProfile ?? 'auto_smart',
        targetColor: settings.targetColor ?? '#FFFFFF',
        colorTolerance: settings.colorTolerance ?? 38,
        alphaUnblend: settings.alphaUnblend ?? true,
      };
    }
    const reg = settings.regions[selectedRegionIndex - 1];
    return {
      ...reg,
      rotation: reg.rotation ?? 0,
      feather: reg.feather ?? settings.feather ?? 14,
      opacity: reg.opacity ?? settings.opacity ?? 100,
      stretchStrength: reg.stretchStrength ?? settings.stretchStrength ?? 85,
      watermarkProfile: reg.watermarkProfile ?? settings.watermarkProfile ?? 'auto_smart',
      targetColor: reg.targetColor ?? settings.targetColor ?? '#FFFFFF',
      colorTolerance: reg.colorTolerance ?? settings.colorTolerance ?? 38,
      alphaUnblend: reg.alphaUnblend ?? settings.alphaUnblend ?? true,
    };
  }, [settings, selectedRegionIndex]);

  // Update current active region parameters
  const updateCurrentRegion = useCallback((patch: Partial<WatermarkRegion>) => {
    setSettings((prev) => {
      if (selectedRegionIndex === 0) {
        return {
          ...prev,
          ...patch,
        };
      }
      const newRegions = [...(prev.regions || [])];
      const targetIdx = selectedRegionIndex - 1;
      if (newRegions[targetIdx]) {
        newRegions[targetIdx] = {
          ...newRegions[targetIdx],
          ...patch,
        };
      }
      return {
        ...prev,
        regions: newRegions,
      };
    });
  }, [selectedRegionIndex]);

  // Render video frame and inpainting preview
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (video && video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, w, h);
    } else {
      // Placeholder dark gradient if video still loading
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#12121f');
      grad.addColorStop(1, '#090912');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#64748b';
      ctx.font = '14px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Loading Video Frame...', w / 2, h / 2);
      return;
    }

    // If user is holding "Compare Original" or picking watermark color with eyedropper, show clean unedited video
    if (showOriginal || isPickingColor) {
      return;
    }

    // Apply real-time watermark inpainting
    if (settings.enabled) {
      applyObjectRemoval(
        ctx,
        w,
        h,
        settings,
        clipTime,
        0,
        canvas,
        activeClip?.animations,
        isPlaying,
        activeClip?.id || '_modal'
      );
    }
  }, [showOriginal, settings, clipTime, isPlaying, activeClip]);

  // Continuous frame loop when playing
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => {});
      const loop = () => {
        if (video && !video.paused && !video.ended) {
          setClipTime(video.currentTime);
          renderFrame();
          animFrameRef.current = requestAnimationFrame(loop);
        }
      };
      animFrameRef.current = requestAnimationFrame(loop);
    } else {
      video.pause();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      renderFrame();
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, renderFrame]);

  // Trigger frame render whenever settings, time, showOriginal or isPickingColor changes
  useEffect(() => {
    renderFrame();
  }, [settings, clipTime, showOriginal, isPickingColor, renderFrame]);

  // Scrub time change handler
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setClipTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
    renderFrame();
  };

  // Helper to obtain a clean un-inpainted frame canvas for accurate watermark color scanning
  const getRawFrameCanvas = useCallback((): HTMLCanvasElement | null => {
    const video = videoRef.current;
    const displayCanvas = canvasRef.current;
    const w = displayCanvas?.width || 1280;
    const h = displayCanvas?.height || 720;
    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = w;
    rawCanvas.height = h;
    const rawCtx = rawCanvas.getContext('2d');
    if (!rawCtx) return null;

    if (video && video.readyState >= 2) {
      rawCtx.drawImage(video, 0, 0, w, h);
    } else if (displayCanvas) {
      rawCtx.drawImage(displayCanvas, 0, 0, w, h);
    } else {
      return null;
    }
    return rawCanvas;
  }, []);

  // Scan the marked box for watermark pixel color, opacity, and famous brand signature
  const handleScanBoxColor = useCallback((customBox?: { x: number; y: number; width: number; height: number }) => {
    const rawCanvas = getRawFrameCanvas();
    if (!rawCanvas) return;

    const box = customBox || currentRegion;
    const result = scanWatermarkColorInBox(rawCanvas, box.x, box.y, box.width, box.height);
    setScannedInfo(result);

    updateCurrentRegion({
      watermarkProfile: result.matchedProfileId,
      targetColor: result.detectedHex,
      alphaUnblend: true,
    });

    const matchedProfile = FAMOUS_WATERMARK_COLOR_PROFILES.find((p) => p.id === result.matchedProfileId);
    toast.success(
      `Detected ${result.detectedHex} (~${result.estimatedOpacity}% opacity) • ${matchedProfile?.name || 'Smart Match'}`
    );
  }, [getRawFrameCanvas, currentRegion, updateCurrentRegion]);

  // Eyedropper click on video canvas to pick exact watermark pixel color
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPickingColor) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    const px = Math.max(0, Math.min(canvas.width - 1, Math.floor((e.clientX - rect.left) * scaleX)));
    const py = Math.max(0, Math.min(canvas.height - 1, Math.floor((e.clientY - rect.top) * scaleY)));

    const rawCanvas = getRawFrameCanvas() || canvas;
    const ctx = rawCanvas.getContext('2d');
    if (!ctx) return;

    const pixel = ctx.getImageData(px, py, 1, 1).data;
    const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
    const hex = `#${toHex(pixel[0])}${toHex(pixel[1])}${toHex(pixel[2])}`;

    updateCurrentRegion({
      watermarkProfile: 'custom_color',
      targetColor: hex,
      alphaUnblend: true,
    });
    setIsPickingColor(false);
    toast.success(`Picked watermark color ${hex}`);
  };

  // 1-Click Preset application
  const applyPreset = (preset: WatermarkPreset) => {
    updateCurrentRegion({
      x: preset.x,
      y: preset.y,
      width: preset.width,
      height: preset.height,
      feather: preset.feather,
      mode: preset.mode,
      shape: preset.shape,
      stretchStrength: preset.stretchStrength ?? 85,
    });
    toast.success(`Applied ${preset.name} Watermark Preset`);
  };

  // Smart Watermark Auto-Detect
  const handleAutoDetect = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDetecting(true);
    toast.info('Scanning frame for watermarks & logos...');

    try {
      const rawCanvas = getRawFrameCanvas() || canvas;
      // 1. Try AI detection if key exists
      let detectedBox: { x: number; y: number; width: number; height: number; label?: string } | null = null;
      const dataUrl = rawCanvas.toDataURL('image/jpeg', 0.85);

      try {
        const aiResult = await detectWatermarkWithAI(dataUrl);
        if (aiResult && aiResult.detected) {
          detectedBox = aiResult;
          toast.success(`AI Located Watermark: ${aiResult.label || 'Logo Detected'}`);
        }
      } catch (e) {
        // Fallback to local heuristic
      }

      // 2. If AI not available, run instant corner edge gradient heuristic
      if (!detectedBox) {
        const heuristicResult = detectWatermarkRegion(rawCanvas, rawCanvas.width, rawCanvas.height);
        if (heuristicResult) {
          detectedBox = heuristicResult;
          toast.success(`Watermark detected at ${heuristicResult.cornerName} (${heuristicResult.confidence}% confidence)`);
        }
      }

      const targetBox = detectedBox || { x: 88, y: 88, width: 20, height: 12 };
      if (!detectedBox) {
        toast.info('No high-contrast watermark detected. Defaulting to Bottom-Right corner.');
      }

      const colorScan = scanWatermarkColorInBox(rawCanvas, targetBox.x, targetBox.y, targetBox.width, targetBox.height);
      setScannedInfo(colorScan);

      updateCurrentRegion({
        x: targetBox.x,
        y: targetBox.y,
        width: targetBox.width,
        height: targetBox.height,
        mode: 'content_aware',
        shape: 'rectangle',
        watermarkProfile: colorScan.matchedProfileId,
        targetColor: colorScan.detectedHex,
        alphaUnblend: true,
      });
    } catch (err) {
      toast.error('Auto-detection error. Please position box manually.');
    } finally {
      setIsDetecting(false);
    }
  };

  // Add another watermark region (for multi-region watermarks)
  const handleAddRegion = () => {
    const regions = settings.regions || [];
    if (regions.length >= 4) {
      toast.error('Maximum 4 watermark regions supported per clip.');
      return;
    }

    const nextId = `region_${Date.now()}`;
    // Position at top-left by default if primary is at bottom-right
    const newRegion: WatermarkRegion = {
      id: nextId,
      name: `Watermark #${regions.length + 2}`,
      enabled: true,
      mode: 'content_aware',
      shape: 'rectangle',
      x: 12,
      y: 12,
      width: 18,
      height: 10,
      feather: 14,
      opacity: 100,
      stretchStrength: 85,
    };

    setSettings((prev) => ({
      ...prev,
      regions: [...(prev.regions || []), newRegion],
    }));

    setSelectedRegionIndex(regions.length + 1);
    toast.success('Added new Watermark Region');
  };

  // Remove extra region
  const handleRemoveRegion = (indexToRemove: number) => {
    if (indexToRemove === 0) return;
    setSettings((prev) => {
      const filtered = (prev.regions || []).filter((_, idx) => idx !== indexToRemove - 1);
      return { ...prev, regions: filtered };
    });
    setSelectedRegionIndex(0);
    toast.info('Watermark Region removed');
  };

  // Canvas drag handlers for interactive on-screen box
  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    handle: 'move' | 'nw' | 'ne' | 'se' | 'sw'
  ) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    setDragHandle(handle);

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: currentRegion.x,
      startY: currentRegion.y,
      startW: currentRegion.width,
      startH: currentRegion.height,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragHandle || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const deltaX = ((e.clientX - dragStartRef.current.mouseX) / rect.width) * 100;
    const deltaY = ((e.clientY - dragStartRef.current.mouseY) / rect.height) * 100;

    const { startX, startY, startW, startH } = dragStartRef.current;

    if (dragHandle === 'move') {
      const newX = Math.max(startW / 2, Math.min(100 - startW / 2, startX + deltaX));
      const newY = Math.max(startH / 2, Math.min(100 - startH / 2, startY + deltaY));
      updateCurrentRegion({ x: parseFloat(newX.toFixed(1)), y: parseFloat(newY.toFixed(1)) });
    } else if (dragHandle === 'se') {
      const newW = Math.max(4, Math.min(80, startW + deltaX * 2));
      const newH = Math.max(4, Math.min(60, startH + deltaY * 2));
      updateCurrentRegion({ width: parseFloat(newW.toFixed(1)), height: parseFloat(newH.toFixed(1)) });
    } else if (dragHandle === 'sw') {
      const newW = Math.max(4, Math.min(80, startW - deltaX * 2));
      const newH = Math.max(4, Math.min(60, startH + deltaY * 2));
      updateCurrentRegion({ width: parseFloat(newW.toFixed(1)), height: parseFloat(newH.toFixed(1)) });
    } else if (dragHandle === 'ne') {
      const newW = Math.max(4, Math.min(80, startW + deltaX * 2));
      const newH = Math.max(4, Math.min(60, startH - deltaY * 2));
      updateCurrentRegion({ width: parseFloat(newW.toFixed(1)), height: parseFloat(newH.toFixed(1)) });
    } else if (dragHandle === 'nw') {
      const newW = Math.max(4, Math.min(80, startW - deltaX * 2));
      const newH = Math.max(4, Math.min(60, startH - deltaY * 2));
      updateCurrentRegion({ width: parseFloat(newW.toFixed(1)), height: parseFloat(newH.toFixed(1)) });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
      setIsDragging(false);
      setDragHandle(null);
    }
  };

  // Commit and Save to Clip
  const handleApplyToClip = () => {
    if (!activeClip) return;

    updateClip(activeClip.id, {
      objectRemoval: {
        ...settings,
        enabled: true,
      },
    });

    saveSnapshot('Apply Watermark Removal');
    toast.success(`Watermark removal applied to ${activeClip.name || 'clip'}!`);
    onClose();
  };

  // Reset / Clear removal on clip
  const handleClearWatermark = () => {
    if (!activeClip) return;
    updateClip(activeClip.id, {
      objectRemoval: {
        ...settings,
        enabled: false,
      },
    });
    setSettings((prev) => ({ ...prev, enabled: false }));
    saveSnapshot('Clear Watermark Removal');
    toast.info('Watermark removal disabled');
  };

  const clipDuration = activeClip?.duration || 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-6xl h-[92vh] bg-[#0c0c16] border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        
        {/* Hidden video element for frame decoding */}
        {activeMedia?.url && (
          <video
            ref={videoRef}
            src={activeMedia.url}
            crossOrigin="anonymous"
            className="hidden"
            playsInline
            muted
            onLoadedMetadata={() => {
              if (videoRef.current && canvasRef.current) {
                canvasRef.current.width = videoRef.current.videoWidth || 1280;
                canvasRef.current.height = videoRef.current.videoHeight || 720;
                renderFrame();
              }
            }}
          />
        )}

        {/* TOP BAR / HEADER */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-cyan-500/20 bg-[#101020]/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/40">
              <Eraser className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  AI Video Watermark Remover
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-cyan-500/20 text-cyan-400 rounded-full border border-cyan-500/30 uppercase tracking-wider">
                  Inpaint & De-Logo
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Erase TikTok stamps, channel bugs, handles, and logos with content-aware inpainting
              </p>
            </div>
          </div>

          {/* CLIP SELECTOR DROPDOWN & CLOSE */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#18182c] px-3 py-1.5 rounded-lg border border-white/10">
              <span className="text-xs text-slate-400">Target Clip:</span>
              <select
                value={activeClipId}
                onChange={(e) => setActiveClipId(e.target.value)}
                className="bg-transparent text-xs text-cyan-300 font-medium focus:outline-none cursor-pointer"
              >
                {availableClips.map((item) => (
                  <option key={item.clip.id} value={item.clip.id} className="bg-[#18182c] text-white">
                    {item.mediaTitle} ({item.trackName})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MAIN BODY: PREVIEW (LEFT) + CONTROLS (RIGHT) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* LEFT: VIDEO PREVIEW CANVAS & ON-SCREEN DRAG OVERLAY */}
          <div className="flex-1 flex flex-col bg-[#07070e] p-4 border-r border-white/10 relative overflow-hidden select-none">
            
            {/* CANVAS WRAPPER */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden min-h-0">
              <div
                ref={containerRef}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="relative max-w-full max-h-full aspect-video shadow-2xl rounded-lg overflow-hidden border border-white/10 bg-black"
                style={{ width: '100%', height: '100%', maxHeight: 'calc(100% - 10px)' }}
              >
                {/* RENDER CANVAS */}
                <canvas
                  ref={canvasRef}
                  width={1280}
                  height={720}
                  onClick={handleCanvasClick}
                  className={`w-full h-full object-contain block ${
                    isPickingColor ? 'cursor-crosshair' : ''
                  }`}
                />

                {/* INTERACTIVE WATERMARK BOUNDING BOX OVERLAY */}
                {settings.enabled && !showOriginal && !isPickingColor && (
                  <div
                    onPointerDown={(e) => handlePointerDown(e, 'move')}
                    className="absolute cursor-move border-2 border-cyan-400 bg-cyan-500/15 hover:bg-cyan-500/25 transition-colors group"
                    style={{
                      left: `${Math.max(0, currentRegion.x - currentRegion.width / 2)}%`,
                      top: `${Math.max(0, currentRegion.y - currentRegion.height / 2)}%`,
                      width: `${currentRegion.width}%`,
                      height: `${currentRegion.height}%`,
                      borderRadius: currentRegion.shape === 'ellipse' ? '50%' : '4px',
                    }}
                  >
                    {/* Corner dimension tag */}
                    <div className="absolute -top-6 left-0 px-1.5 py-0.5 rounded bg-black/80 border border-cyan-500/40 text-[10px] font-mono text-cyan-300 pointer-events-none whitespace-nowrap shadow-md">
                      {currentRegion.width.toFixed(0)}% × {currentRegion.height.toFixed(0)}%
                    </div>

                    {/* Center Crosshair */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-60">
                      <div className="w-2.5 h-0.5 bg-cyan-400" />
                      <div className="h-2.5 w-0.5 bg-cyan-400 absolute" />
                    </div>

                    {/* 4 Corner Resize Handles */}
                    <div
                      onPointerDown={(e) => handlePointerDown(e, 'nw')}
                      className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-cyan-400 border border-black rounded-sm cursor-nw-resize shadow-md"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, 'ne')}
                      className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-cyan-400 border border-black rounded-sm cursor-ne-resize shadow-md"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, 'sw')}
                      className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-cyan-400 border border-black rounded-sm cursor-sw-resize shadow-md"
                    />
                    <div
                      onPointerDown={(e) => handlePointerDown(e, 'se')}
                      className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-cyan-400 border border-black rounded-sm cursor-se-resize shadow-md"
                    />
                  </div>
                )}

                {/* Additional watermark boxes if multi-region */}
                {settings.enabled && !showOriginal && !isPickingColor && settings.regions && settings.regions.map((reg, idx) => {
                  const regIdx = idx + 1;
                  if (regIdx === selectedRegionIndex || !reg.enabled) return null;
                  return (
                    <div
                      key={reg.id || idx}
                      onClick={() => setSelectedRegionIndex(regIdx)}
                      className="absolute cursor-pointer border-2 border-dashed border-cyan-400/50 bg-cyan-400/10 hover:border-cyan-400 hover:bg-cyan-400/20 rounded transition-all"
                      style={{
                        left: `${Math.max(0, reg.x - reg.width / 2)}%`,
                        top: `${Math.max(0, reg.y - reg.height / 2)}%`,
                        width: `${reg.width}%`,
                        height: `${reg.height}%`,
                      }}
                      title={`Click to edit ${reg.name || `Watermark #${regIdx}`}`}
                    >
                      <div className="absolute top-1 left-1 px-1 py-0.5 rounded bg-black/70 text-[9px] text-cyan-300">
                        #{regIdx}
                      </div>
                    </div>
                  );
                })}

                {/* Original badge indicator when comparing or picking color */}
                {(showOriginal || isPickingColor) && (
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-amber-500/90 text-black font-bold text-xs uppercase tracking-wider shadow-lg flex items-center gap-1.5">
                    {isPickingColor ? (
                      <>
                        <Pipette className="w-3.5 h-3.5" />
                        <span>Click any watermark letter to sample its color</span>
                      </>
                    ) : (
                      <span>Showing Original Video</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* PREVIEW TOOLBAR & TIMELINE SCRUBBER */}
            <div className="mt-3 bg-[#111122] p-3 rounded-xl border border-white/10 flex flex-col gap-2.5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-8 h-8 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center transition-colors shadow-md"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>

                <div className="flex-1 flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={clipDuration}
                    step={0.05}
                    value={clipTime}
                    onChange={handleTimeChange}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                  <span className="text-xs font-mono text-cyan-300 min-w-14 text-right">
                    {clipTime.toFixed(2)}s
                  </span>
                </div>

                {/* COMPARE BUTTON */}
                <button
                  onMouseDown={() => setShowOriginal(true)}
                  onMouseUp={() => setShowOriginal(false)}
                  onTouchStart={() => setShowOriginal(true)}
                  onTouchEnd={() => setShowOriginal(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                    showOriginal
                      ? 'bg-amber-500 text-black border-amber-400'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                  }`}
                  title="Hold mouse down to view original unedited video"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Hold to Compare</span>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: SETTINGS, PRESETS & MULTI-REGION CONTROLS */}
          <div className="w-full md:w-96 bg-[#0f0f1c] p-4 flex flex-col gap-4 overflow-y-auto border-t md:border-t-0 border-white/10 custom-scrollbar">
            
            {/* 1. 1-CLICK CORNER PRESETS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  ⚡ 1-Click Corner Presets
                </span>
                <button
                  onClick={handleAutoDetect}
                  disabled={isDetecting}
                  className="px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-md flex items-center gap-1 transition-all disabled:opacity-50"
                  title="Auto-detect watermark location"
                >
                  <Wand2 className="w-3 h-3" />
                  {isDetecting ? 'Scanning...' : 'Auto-Detect'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {WATERMARK_PRESETS.slice(0, 4).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p)}
                    className="p-2 rounded-lg bg-[#16162a] hover:bg-cyan-500/20 border border-white/5 hover:border-cyan-500/40 text-left transition-all group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{p.icon}</span>
                      <span className="text-xs font-semibold text-white group-hover:text-cyan-300">
                        {p.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{p.description}</p>
                  </button>
                ))}
              </div>

              {/* Extra presets row */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {WATERMARK_PRESETS.slice(4).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p)}
                    className="py-1.5 px-2 rounded-lg bg-[#16162a] hover:bg-cyan-500/20 border border-white/5 hover:border-cyan-500/40 text-center transition-all group"
                  >
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-cyan-300 flex items-center justify-center gap-1">
                      {p.icon} {p.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. REMOVAL INPAINTING ENGINE MODE */}
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Inpainting Method
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => updateCurrentRegion({ mode: 'content_aware' })}
                  className={`p-2.5 rounded-lg text-xs font-bold text-left border transition-all ${
                    currentRegion.mode === 'content_aware'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm'
                      : 'bg-[#16162a] border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  🔮 Content-Aware
                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                    Smart pixel unblending
                  </span>
                </button>

                <button
                  onClick={() => updateCurrentRegion({ mode: 'blur_conceal' })}
                  className={`p-2.5 rounded-lg text-xs font-bold text-left border transition-all ${
                    currentRegion.mode === 'blur_conceal'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm'
                      : 'bg-[#16162a] border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  💧 Gaussian De-Logo
                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                    Broadcast blur
                  </span>
                </button>

                <button
                  onClick={() => updateCurrentRegion({ mode: 'pixelate' })}
                  className={`p-2.5 rounded-lg text-xs font-bold text-left border transition-all ${
                    currentRegion.mode === 'pixelate'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm'
                      : 'bg-[#16162a] border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  🔲 Mosaic Pixelate
                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                    Censor block
                  </span>
                </button>

                <button
                  onClick={() => updateCurrentRegion({ mode: 'patch_replace' })}
                  className={`p-2.5 rounded-lg text-xs font-bold text-left border transition-all ${
                    currentRegion.mode === 'patch_replace'
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm'
                      : 'bg-[#16162a] border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  📋 Clone Stamp
                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                    Sample clean area
                  </span>
                </button>
              </div>
            </div>

            {/* 2.5 FAMOUS WATERMARK COLOR SIGNATURES & REVERSE ALPHA UNBLENDING */}
            {currentRegion.mode === 'content_aware' && (
              <div className="space-y-2.5 pt-2.5 border-t border-white/10 bg-[#131325]/90 p-3 rounded-xl border border-cyan-500/20">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1">
                    🎨 Watermark Color Signature
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleScanBoxColor()}
                      className="px-2 py-0.5 text-[10px] font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-md flex items-center gap-1 transition-all"
                      title="Scan marked box to find exact watermark pixel color & opacity"
                    >
                      <ScanSearch className="w-3 h-3" />
                      Scan Box
                    </button>
                    <button
                      onClick={() => setIsPickingColor(!isPickingColor)}
                      className={`p-1 rounded-md border transition-all ${
                        isPickingColor
                          ? 'bg-amber-500 text-black border-amber-400'
                          : 'bg-[#1a1a32] hover:bg-white/10 text-slate-300 border-white/10'
                      }`}
                      title="Pick watermark pixel color directly from video frame"
                    >
                      <Pipette className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Finds only the watermark-colored pixels inside the box and unblends them with background—keeping clean video between letters 100% sharp.
                </p>

                {/* Scanned Watermark Telemetry Badge */}
                {scannedInfo && (
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-black/40 border border-cyan-500/30 text-[10px]">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/30 shadow-sm"
                        style={{ backgroundColor: scannedInfo.detectedHex }}
                      />
                      <span className="font-mono font-bold text-white">{scannedInfo.detectedHex}</span>
                      <span className="text-cyan-300">~{scannedInfo.estimatedOpacity}% α</span>
                    </div>
                    <span className="text-slate-400 font-mono">
                      {Math.round(scannedInfo.watermarkPixelRatio * 100)}% of box
                    </span>
                  </div>
                )}

                {/* Famous Watermark Color Profile Grid */}
                <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-0.5 custom-scrollbar">
                  {FAMOUS_WATERMARK_COLOR_PROFILES.map((prof) => {
                    const isSelected = (currentRegion.watermarkProfile || 'auto_smart') === prof.id;
                    return (
                      <button
                        key={prof.id}
                        onClick={() =>
                          updateCurrentRegion({
                            watermarkProfile: prof.id,
                            targetColor: prof.primaryHex,
                            colorTolerance: prof.defaultTolerance,
                            alphaUnblend: prof.id !== 'full_box',
                          })
                        }
                        className={`p-1.5 rounded-lg text-left border transition-all ${
                          isSelected
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-sm'
                            : 'bg-[#17172b] border-white/5 text-slate-300 hover:border-cyan-500/30'
                        }`}
                        title={`${prof.description} (${prof.brands})`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-bold truncate">
                            {prof.icon} {prof.name}
                          </span>
                          <div className="flex items-center -space-x-1 shrink-0">
                            {prof.colors.slice(0, 3).map((c, ci) => (
                              <span
                                key={ci}
                                className="w-2.5 h-2.5 rounded-full border border-black/60"
                                style={{ backgroundColor: c.hex }}
                              />
                            ))}
                          </div>
                        </div>
                        <span className="block text-[9px] text-slate-400 truncate mt-0.5">
                          {prof.brands}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Target Color Picker + Tolerance Slider */}
                {currentRegion.watermarkProfile !== 'full_box' && (
                  <div className="space-y-2 pt-1.5 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400">Target Watermark Color</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={currentRegion.targetColor || '#FFFFFF'}
                          onChange={(e) =>
                            updateCurrentRegion({
                              watermarkProfile: 'custom_color',
                              targetColor: e.target.value.toUpperCase(),
                            })
                          }
                          className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
                        />
                        <span className="font-mono text-[11px] text-cyan-300">
                          {(currentRegion.targetColor || '#FFFFFF').toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Color Detection Sensitivity */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Color Match Sensitivity</span>
                        <span className="font-mono text-cyan-400">{currentRegion.colorTolerance ?? 38}%</span>
                      </div>
                      <input
                        type="range"
                        min={5}
                        max={95}
                        step={1}
                        value={currentRegion.colorTolerance ?? 38}
                        onChange={(e) => updateCurrentRegion({ colorTolerance: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-[#18182a] rounded-lg appearance-none cursor-pointer accent-cyan-500"
                      />
                    </div>

                    {/* Reverse Alpha Unblending Toggle */}
                    <label className="flex items-center justify-between cursor-pointer select-none pt-1">
                      <div>
                        <span className="text-[11px] text-cyan-300 font-semibold block">
                          🧮 Reverse Alpha Unblending
                        </span>
                        <span className="text-[9px] text-slate-400 block">
                          Recovers video under semi-transparent white (#FFFFFF)
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={currentRegion.alphaUnblend !== false}
                        onChange={(e) => updateCurrentRegion({ alphaUnblend: e.target.checked })}
                        className="rounded accent-cyan-500 cursor-pointer"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* 3. MULTI-REGION WATERMARK LIST */}
            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Watermark Regions ({1 + (settings.regions?.length || 0)})
                </span>
                <button
                  onClick={handleAddRegion}
                  className="px-2 py-0.5 text-[10px] font-bold bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/30 rounded-md flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3 h-3" />
                  Add Watermark
                </button>
              </div>

              <div className="flex flex-col gap-1">
                {/* Primary Region */}
                <div
                  onClick={() => setSelectedRegionIndex(0)}
                  className={`px-3 py-1.5 rounded-lg flex items-center justify-between text-xs cursor-pointer border transition-all ${
                    selectedRegionIndex === 0
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-[#141426] border-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="font-semibold">#1 Primary Watermark</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    ({settings.x.toFixed(0)}%, {settings.y.toFixed(0)}%)
                  </span>
                </div>

                {/* Additional Regions */}
                {settings.regions && settings.regions.map((reg, idx) => {
                  const regIdx = idx + 1;
                  const isSel = selectedRegionIndex === regIdx;
                  return (
                    <div
                      key={reg.id || idx}
                      onClick={() => setSelectedRegionIndex(regIdx)}
                      className={`px-3 py-1.5 rounded-lg flex items-center justify-between text-xs cursor-pointer border transition-all ${
                        isSel
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                          : 'bg-[#141426] border-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="font-semibold">{reg.name || `#${regIdx + 1} Extra Watermark`}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400">
                          ({reg.x.toFixed(0)}%, {reg.y.toFixed(0)}%)
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveRegion(regIdx);
                          }}
                          className="text-red-400 hover:text-red-300 p-0.5 rounded"
                          title="Remove this watermark region"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. FINE-TUNE POSITION & SIZE SLIDERS */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Region Fine-Tuning
              </span>

              {/* Position X Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Horizontal Center (X)</span>
                  <span className="font-mono text-cyan-400">{currentRegion.x.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={currentRegion.x}
                  onChange={(e) => updateCurrentRegion({ x: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-[#18182a] rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              {/* Position Y Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Vertical Center (Y)</span>
                  <span className="font-mono text-cyan-400">{currentRegion.y.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={currentRegion.y}
                  onChange={(e) => updateCurrentRegion({ y: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-[#18182a] rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              {/* Width Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Box Width</span>
                  <span className="font-mono text-cyan-400">{currentRegion.width.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={80}
                  step={0.5}
                  value={currentRegion.width}
                  onChange={(e) => updateCurrentRegion({ width: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-[#18182a] rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              {/* Height Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Box Height</span>
                  <span className="font-mono text-cyan-400">{currentRegion.height.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={60}
                  step={0.5}
                  value={currentRegion.height}
                  onChange={(e) => updateCurrentRegion({ height: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-[#18182a] rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              {/* Edge Feather Softness Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Edge Feather Softness</span>
                  <span className="font-mono text-cyan-400">{currentRegion.feather} px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={1}
                  value={currentRegion.feather}
                  onChange={(e) => updateCurrentRegion({ feather: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-[#18182a] rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              {/* Inward Stretch Strength (for Content-Aware) */}
              {currentRegion.mode === 'content_aware' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Inward Stretch Strength</span>
                    <span className="font-mono text-cyan-400">{currentRegion.stretchStrength}%</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={1}
                    value={currentRegion.stretchStrength}
                    onChange={(e) => updateCurrentRegion({ stretchStrength: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-[#18182a] rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>
              )}
            </div>

            {/* ACTION BUTTONS (BOTTOM) */}
            <div className="pt-4 mt-auto border-t border-white/10 flex flex-col gap-2">
              <button
                onClick={handleApplyToClip}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/30 transition-all"
              >
                <Check className="w-4 h-4" />
                Apply Watermark Removal
              </button>

              <div className="flex gap-2">
                <button
                  onClick={handleClearWatermark}
                  className="flex-1 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/20"
                >
                  Clear from Clip
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors border border-white/10"
                >
                  Cancel
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
