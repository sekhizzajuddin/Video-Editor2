import { useState, useRef, useCallback } from 'react';
import { useEditorStore } from '@/store/editorStore';

export interface DragState {
  clipId: string;
  startX: number;
  startY: number;
  originalStartTime: number;
  originalScrollLeft: number;
  trackId: string;
  trackType: string;
  draggedClips?: {
    id: string;
    originalStartTime: number;
    trackId: string;
  }[];
}

export interface ResizeState {
  clipId: string;
  edge: 'left' | 'right';
  startX: number;
  originalDuration: number;
  originalTrimStart: number;
  originalTrimEnd: number;
  originalStartTime: number;
  originalSpeed: number;
  siblingClip?: {
    id: string;
    originalTrimStart: number;
    originalTrimEnd: number;
    originalDuration: number;
    originalStartTime: number;
    speed: number;
  };
  rippleClips?: {
    id: string;
    originalStartTime: number;
  }[];
}

export interface SlipState {
  clipId: string;
  startX: number;
  originalTrimStart: number;
  originalTrimEnd: number;
}

export interface SlideState {
  clipId: string;
  startX: number;
  originalStartTime: number;
  adjacentClips: {
    left?: { id: string; originalTrimEnd: number; originalDuration: number };
    right?: { id: string; originalTrimStart: number; originalDuration: number; originalStartTime: number };
  };
}

export interface DragOverLayerState {
  overLayerId: string;
  startX: number;
  startY: number;
  originalStartTime: number;
  trackId: string;
}

export interface ResizeOverLayerState {
  overLayerId: string;
  edge: 'left' | 'right';
  startX: number;
  originalDuration: number;
  originalStartTime: number;
}

export interface DropPreview {
  time: number;
  duration: number;
  trackIdx: number;
  mediaId?: string;
  mediaType?: string;
  mediaName?: string;
}

export interface ContextMenuState {
  x: number;
  y: number;
  clipId: string;
  trackType: string;
  mediaType: string;
  isOverLayer?: boolean;
  trackId?: string;
}

export interface MarkerContextMenuState {
  x: number;
  y: number;
  markerId: string;
}

export function useTimelineState() {
  // DOM element refs
  const timelineRef = useRef<HTMLDivElement>(null);
  const trackContainerRef = useRef<HTMLDivElement>(null);
  const trackHeadersRef = useRef<HTMLDivElement>(null);
  const rulerContainerRef = useRef<HTMLDivElement>(null);

  // Drag and drop states
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [slipState, setSlipState] = useState<SlipState | null>(null);
  const [slideState, setSlideState] = useState<SlideState | null>(null);
  
  const [dragOverLayerState, setDragOverLayerState] = useState<DragOverLayerState | null>(null);
  const [resizeOverLayerState, setResizeOverLayerState] = useState<ResizeOverLayerState | null>(null);
  const [snapLine, setSnapLine] = useState<number | null>(null);
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);

  // Playhead scrubbing and cut tool states
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const [scrubMouseX, setScrubMouseX] = useState<number>(0);
  const [hoverCutClipId, setHoverCutClipId] = useState<string | null>(null);
  const [hoverCutX, setHoverCutX] = useState<number | null>(null);

  // Context menus
  const [contextMenu, _setContextMenu] = useState<ContextMenuState | null>(null);
  const [markerContextMenu, _setMarkerContextMenu] = useState<MarkerContextMenuState | null>(null);

  const setContextMenu = useCallback((val: ContextMenuState | null) => {
    _setContextMenu(val);
    if (val) _setMarkerContextMenu(null);
  }, []);

  const setMarkerContextMenu = useCallback((val: MarkerContextMenuState | null) => {
    _setMarkerContextMenu(val);
    if (val) _setContextMenu(null);
  }, []);

  // Transaction tracking refs
  const transactionActiveRef = useRef(false);

  const startTransactionSafe = useCallback(() => {
    if (!transactionActiveRef.current) {
      useEditorStore.getState().startTransaction();
      transactionActiveRef.current = true;
    }
  }, []);

  const endTransactionSafe = useCallback(() => {
    if (transactionActiveRef.current) {
      useEditorStore.getState().endTransaction();
      transactionActiveRef.current = false;
    }
  }, []);

  // AI SFX Generator States
  const [sfxModalClipId, setSfxModalClipId] = useState<string | null>(null);
  const [sfxCategory, setSfxCategory] = useState<string>('explosion');
  const [sfxDuration, setSfxDuration] = useState<number>(1.0);
  const [sfxName, setSfxName] = useState<string>('Sound Effect');
  const [isAnalyzingSfx, setIsAnalyzingSfx] = useState<boolean>(false);
  const [isSynthesizingSfx, setIsSynthesizingSfx] = useState<boolean>(false);

  // AI SFX Auto-Cue States
  const [sfxAutoCueClipId, setSfxAutoCueClipId] = useState<string | null>(null);
  const [sfxUserDescription, setSfxUserDescription] = useState<string>('');
  const [sfxAutoCueMode, setSfxAutoCueMode] = useState<'visual' | 'ai_script'>('visual');
  const [isAnalyzingAutoCue, setIsAnalyzingAutoCue] = useState<boolean>(false);
  const [autoCueProgress, setAutoCueProgress] = useState<number>(0);

  // Subtitle transcription states
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Scroll sync refs
  const scrollStoreThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dragMouseXRef = useRef<number | null>(null);
  const dragMouseYRef = useRef<number | null>(null);
  const scrubRafIdRef = useRef<number | null>(null);

  // Mouse handlers refs
  const handleMouseMoveRef = useRef<any>(null);
  const handleMouseUpRef = useRef<any>(null);

  return {
    timelineRef,
    trackContainerRef,
    trackHeadersRef,
    rulerContainerRef,
    
    dragState,
    setDragState,
    resizeState,
    setResizeState,
    slipState,
    setSlipState,
    slideState,
    setSlideState,
    dragOverLayerState,
    setDragOverLayerState,
    resizeOverLayerState,
    setResizeOverLayerState,
    snapLine,
    setSnapLine,
    hoveredTrackId,
    setHoveredTrackId,
    dropPreview,
    setDropPreview,

    isScrubbing,
    setIsScrubbing,
    scrubTime,
    setScrubTime,
    scrubMouseX,
    setScrubMouseX,
    hoverCutClipId,
    setHoverCutClipId,
    hoverCutX,
    setHoverCutX,

    contextMenu,
    setContextMenu,
    markerContextMenu,
    setMarkerContextMenu,

    transactionActiveRef,
    startTransactionSafe,
    endTransactionSafe,

    sfxModalClipId,
    setSfxModalClipId,
    sfxCategory,
    setSfxCategory,
    sfxDuration,
    setSfxDuration,
    sfxName,
    setSfxName,
    isAnalyzingSfx,
    setIsAnalyzingSfx,
    isSynthesizingSfx,
    setIsSynthesizingSfx,

    sfxAutoCueClipId,
    setSfxAutoCueClipId,
    sfxUserDescription,
    setSfxUserDescription,
    sfxAutoCueMode,
    setSfxAutoCueMode,
    isAnalyzingAutoCue,
    setIsAnalyzingAutoCue,
    autoCueProgress,
    setAutoCueProgress,

    isTranscribing,
    setIsTranscribing,

    scrollStoreThrottleRef,
    scrollIntervalRef,
    dragMouseXRef,
    dragMouseYRef,
    scrubRafIdRef,
    handleMouseMoveRef,
    handleMouseUpRef,
  };
}

export type TimelineState = ReturnType<typeof useTimelineState>;
