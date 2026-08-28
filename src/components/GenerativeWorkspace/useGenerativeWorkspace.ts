import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import type {
  GenerativeResult,
  GenerativeMotionOptions,
} from '@/utils/generateMotionGraphicsFromDialogue';
import type { MotionGraphicVideo } from '@/utils/motionGraphicRenderer';
import type { MediaItem, TimelineClip, TimelineTrack } from '@/types';

export type GenerativeMode = 'clip' | 'text';
export type GenerativeStep =
  | 'idle'
  | 'extracting'
  | 'transcribing'
  | 'designing'
  | 'rendering'
  | 'encoding'
  | 'done'
  | 'error';

/** Dedicated, reusable track used for generative overlays. */
export const MOTION_OVERLAY_TRACK_NAME = 'Motion Overlay';

export function useGenerativeWorkspace() {
  const [mode, setMode] = useState<GenerativeMode>('clip');
  const [selectedClipUrl, setSelectedClipUrl] = useState<string | null>(null);
  const [selectedClipName, setSelectedClipName] = useState<string>('');
  const [selectedClipDuration, setSelectedClipDuration] = useState<number>(0);
  const [dialogueText, setDialogueText] = useState<string>('');
  const [targetDuration, setTargetDuration] = useState<number>(15);
  const [style, setStyle] = useState<string>('mixed');
  const [layout, setLayout] = useState<string>('mixed');
  const [provider, setProvider] = useState<'gemini' | 'groq'>('gemini');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [transparent, setTransparent] = useState<boolean>(true);
  const [step, setStep] = useState<GenerativeStep>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [result, setResult] = useState<GenerativeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCodeEditor, setShowCodeEditor] = useState<boolean>(false);
  const [editedHtmlCss, setEditedHtmlCss] = useState<string>('');
  const [originalHtmlCss, setOriginalHtmlCss] = useState<string>('');
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [motionVideoUrl, setMotionVideoUrl] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const videoUrlRef = useRef<string | null>(null);

  /**
   * Publishes a fresh object URL for a rendered overlay and releases the
   * previous one. Called from event handlers (never from an effect) so the URL
   * lifecycle stays tied to user actions.
   */
  const publishVideoUrl = useCallback((blob: Blob | null | undefined) => {
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    }
    const url = blob && blob.size > 8 ? URL.createObjectURL(blob) : null;
    videoUrlRef.current = url;
    setMotionVideoUrl(url);
  }, []);

  // Release the object URL when the workspace unmounts.
  useEffect(() => {
    return () => {
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
        videoUrlRef.current = null;
      }
    };
  }, []);

  const isDirty = useMemo(
    () => !!editedHtmlCss && editedHtmlCss !== originalHtmlCss,
    [editedHtmlCss, originalHtmlCss]
  );

  const handleClipDrop = useCallback((url: string, name: string, duration: number): boolean => {
    if (duration > 30) {
      toast.error('Clip must be 30 seconds or less');
      return false;
    }
    setSelectedClipUrl(url);
    setSelectedClipName(name || 'Selected Clip');
    setSelectedClipDuration(duration || 0);
    if (duration > 0) {
      setTargetDuration(Math.min(30, Math.max(1, Math.round(duration))));
    }
    return true;
  }, []);

  const handleRemoveClip = useCallback(() => {
    setSelectedClipUrl(null);
    setSelectedClipName('');
    setSelectedClipDuration(0);
  }, []);

  const mapToStepId = (rawStep: string): GenerativeStep => {
    const l = (rawStep || '').toLowerCase();
    if (l.includes('extract') || l.includes('frame')) return 'extracting';
    if (l.includes('transcrib')) return 'transcribing';
    if (l.includes('design') || l.includes('ai') || l.includes('validat')) return 'designing';
    if (l.includes('render') || l.includes('draw')) return 'rendering';
    if (l.includes('encod') || l.includes('mux')) return 'encoding';
    return 'designing';
  };

  const handleGenerate = useCallback(
    async (promptOverride?: string) => {
      if (mode === 'clip' && !selectedClipUrl) {
        toast.error('Please drop or select a clip first');
        return;
      }
      if (mode === 'text' && !dialogueText.trim()) {
        toast.error('Please enter dialogue text first');
        return;
      }

      setError(null);
      setResult(null);
      setStep('extracting');
      setProgress(5);
      setProgressMessage('Starting generation pipeline...');

      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const { generateMotionGraphicsFromDialogue } = await import(
          '@/utils/generateMotionGraphicsFromDialogue'
        );

        const promptToUse = typeof promptOverride === 'string' ? promptOverride : customPrompt;

        const genOptions: GenerativeMotionOptions = {
          dialogueText: dialogueText.trim(),
          targetDuration: mode === 'clip' ? selectedClipDuration || 15 : targetDuration,
          style,
          layout,
          provider,
          customPrompt: promptToUse,
          signal: controller.signal,
          transparent,
        };

        const genResult = await generateMotionGraphicsFromDialogue(
          mode === 'clip' ? selectedClipUrl : null,
          mode === 'clip' ? selectedClipDuration || 15 : targetDuration,
          genOptions,
          (currentStep: string, currentProgress: number) => {
            setStep(mapToStepId(currentStep));
            setProgress(currentProgress);
            setProgressMessage(currentStep);
          }
        );

        const sceneHtml = genResult.spec?.htmlCssScenes?.[0]?.htmlCss || '';
        publishVideoUrl(genResult.video?.blob);
        setResult(genResult);
        setEditedHtmlCss(sceneHtml);
        setOriginalHtmlCss(sceneHtml);
        setStep('done');
        setProgress(100);
        setProgressMessage('Generation complete');
        toast.success('Motion graphics generated successfully!');
        return genResult;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          setStep('idle');
          setProgress(0);
          setProgressMessage('');
          return null;
        }
        const errMsg = err?.message || 'An error occurred during generation';
        setError(errMsg);
        setStep('error');
        setProgress(0);
        toast.error(errMsg);
        return null;
      } finally {
        abortControllerRef.current = null;
      }
    },
    [
      mode,
      selectedClipUrl,
      selectedClipDuration,
      dialogueText,
      targetDuration,
      style,
      layout,
      provider,
      customPrompt,
      transparent,
      publishVideoUrl,
    ]
  );

  /**
   * Re-renders the overlay video from the CURRENT (possibly hand-edited) scene
   * code, without calling the AI again. This is what makes the code editor
   * functional — previously edits were stored in state and then thrown away.
   */
  const handleRenderFromCode = useCallback(async () => {
    if (!result?.spec) {
      toast.error('Generate a motion graphic first');
      return null;
    }

    const sceneCount = result.spec.htmlCssScenes?.length || 0;
    if (sceneCount === 0) {
      toast.error('This result has no HTML/CSS scene to re-render');
      return null;
    }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsRendering(true);
    setStep('rendering');
    setProgress(5);
    setProgressMessage('Rendering edited scene...');
    setError(null);

    try {
      const { renderMotionGraphicToVideo } = await import('@/utils/motionGraphicRenderer');

      const spec = {
        ...result.spec,
        htmlCssScenes: result.spec.htmlCssScenes.map((scene, index) =>
          index === 0 ? { ...scene, htmlCss: editedHtmlCss } : scene
        ),
      };

      const video = await renderMotionGraphicToVideo(
        spec,
        (renderStep, pct) => {
          setStep(mapToStepId(renderStep));
          setProgress(pct);
          setProgressMessage(renderStep);
        },
        { transparent, signal: controller.signal }
      );

      const next: GenerativeResult = {
        ...result,
        spec,
        video,
        designNotes: result.designNotes ?? [],
      };
      publishVideoUrl(video.blob);
      setResult(next);
      setOriginalHtmlCss(editedHtmlCss);
      setStep('done');
      setProgress(100);
      setProgressMessage('Render complete');
      toast.success('Scene re-rendered from your code');
      return next;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setStep('done');
        return null;
      }
      const errMsg = err?.message || 'Failed to render scene';
      setError(errMsg);
      setStep('error');
      toast.error(errMsg);
      return null;
    } finally {
      setIsRendering(false);
      abortControllerRef.current = null;
    }
  }, [result, editedHtmlCss, transparent, publishVideoUrl]);

  /** Ensures a dedicated "Motion Overlay" video track sits on TOP of the stack. */
  const getOrCreateOverlayTrack = useCallback(async (): Promise<TimelineTrack | null> => {
    const { useEditorStore } = await import('@/store/editorStore');
    const state = useEditorStore.getState();

    const existing = state.tracks.find(
      (t) => t.type === 'video' && t.name === MOTION_OVERLAY_TRACK_NAME
    );
    if (existing) return existing;

    const track: TimelineTrack = {
      id: `track_v_motion_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: MOTION_OVERLAY_TRACK_NAME,
      type: 'video',
      clips: [],
      locked: false,
      muted: false,
      hidden: false,
      volume: 1,
      pan: 0,
      solo: false,
      isDynamic: true,
    };

    // Appended last: both the preview engine and the export scheduler composite
    // tracks in array order, so the final track is painted on top.
    useEditorStore.setState({ tracks: [...useEditorStore.getState().tracks, track] });
    return track;
  }, []);

  const handleApplyToTimeline = useCallback(async () => {
    // Hand-edited code must be baked into the video before it hits the timeline,
    // otherwise the overlay would silently ship the AI's original version.
    let target = result;
    if (isDirty && (target?.spec?.htmlCssScenes?.length || 0) > 0) {
      const rendered = await handleRenderFromCode();
      if (rendered) target = rendered;
    }

    const video: MotionGraphicVideo | null | undefined = target?.video;
    if (!video?.blob || video.blob.size <= 8) {
      toast.error('No motion graphic video available to apply');
      return;
    }

    try {
      const { useEditorStore } = await import('@/store/editorStore');
      const store = useEditorStore.getState();

      const mediaId = `gen_motion_${Date.now()}`;
      const blobUrl = URL.createObjectURL(video.blob);
      const finalDuration =
        target?.spec?.duration || (mode === 'clip' ? selectedClipDuration : targetDuration) || 15;
      const mediaName = selectedClipName
        ? `Motion: ${selectedClipName}`
        : `Motion Graphics (${style})`;

      const mediaItem: MediaItem = {
        id: mediaId,
        name: mediaName,
        type: 'video',
        duration: finalDuration,
        url: blobUrl,
        createdAt: Date.now(),
        width: video.width,
        height: video.height,
        frameRate: video.fps,
      };

      // Persist the blob so the overlay survives a project reload.
      let file: File | undefined;
      try {
        file = new File([video.blob], `${mediaName}.webm`, {
          type: video.blob.type || 'video/webm',
        });
      } catch {
        file = undefined;
      }
      store.addMedia(mediaItem, file);

      const track = await getOrCreateOverlayTrack();
      if (!track) {
        toast.error('Could not create an overlay track');
        return;
      }

      // Align the overlay with the source clip when we can find it on the
      // timeline; otherwise drop it at the playhead.
      let startTime = store.currentTime || 0;
      if (mode === 'clip' && selectedClipUrl) {
        const sourceMedia = useEditorStore
          .getState()
          .mediaLibrary.find((m) => m.url === selectedClipUrl);
        if (sourceMedia) {
          for (const t of useEditorStore.getState().tracks) {
            const sourceClip = (t.clips || []).find((c) => c.mediaId === sourceMedia.id);
            if (sourceClip) {
              startTime = sourceClip.startTime;
              break;
            }
          }
        }
      }

      const clipId = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const newClip: TimelineClip = {
        id: clipId,
        mediaId,
        trackId: track.id,
        startTime,
        duration: finalDuration,
        trimStart: 0,
        trimEnd: 0,
        transform: { x: 0, y: 0, scale: 100, rotation: 0 },
        opacity: 1,
        speed: 1,
        effects: [],
        // When the browser could not encode a real alpha channel the overlay was
        // rendered on a key colour plate — recover transparency automatically.
        ...(video.alphaMode === 'key' && video.keyColor
          ? {
              chromaKey: {
                enabled: true,
                color: video.keyColor,
                threshold: 42,
                softness: 16,
                spillSuppression: 60,
                edgeFeather: 1,
                alwaysApply: true,
              },
            }
          : {}),
      };

      store.addClip(newClip);

      const { useEditorStore: storeRef } = await import('@/store/editorStore');
      storeRef.getState().recalcTotalDuration?.();
      storeRef.getState().saveSnapshot?.('Add Motion Graphics Overlay');

      toast.success(
        video.alphaMode === 'alpha'
          ? 'Motion graphics overlay added (transparent alpha)'
          : 'Motion graphics overlay added (auto chroma-keyed)'
      );
    } catch (err: any) {
      console.error('Failed to apply motion graphics to timeline:', err);
      toast.error('Failed to apply to timeline: ' + (err?.message || 'Unknown error'));
    }
  }, [
    result,
    isDirty,
    handleRenderFromCode,
    mode,
    selectedClipDuration,
    targetDuration,
    selectedClipName,
    selectedClipUrl,
    style,
    getOrCreateOverlayTrack,
  ]);

  const handleRePrompt = useCallback(
    (newPrompt: string) => {
      setCustomPrompt(newPrompt);
      handleGenerate(newPrompt);
    },
    [handleGenerate]
  );

  const handleResetCode = useCallback(() => {
    setEditedHtmlCss(originalHtmlCss);
    toast.info('Code reset to original AI version');
  }, [originalHtmlCss]);

  const resetAll = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMode('clip');
    setSelectedClipUrl(null);
    setSelectedClipName('');
    setSelectedClipDuration(0);
    setDialogueText('');
    setTargetDuration(15);
    setStyle('mixed');
    setLayout('mixed');
    setProvider('gemini');
    setCustomPrompt('');
    setTransparent(true);
    setStep('idle');
    setProgress(0);
    setProgressMessage('');
    setResult(null);
    setError(null);
    setShowCodeEditor(false);
    setEditedHtmlCss('');
    setOriginalHtmlCss('');
    setIsRendering(false);
    publishVideoUrl(null);
  }, [publishVideoUrl]);

  return {
    mode,
    setMode,
    selectedClipUrl,
    setSelectedClipUrl,
    selectedClipName,
    setSelectedClipName,
    selectedClipDuration,
    setSelectedClipDuration,
    dialogueText,
    setDialogueText,
    targetDuration,
    setTargetDuration,
    style,
    setStyle,
    layout,
    setLayout,
    provider,
    setProvider,
    customPrompt,
    setCustomPrompt,
    transparent,
    setTransparent,
    step,
    setStep,
    progress,
    setProgress,
    progressMessage,
    setProgressMessage,
    result,
    setResult,
    motionVideoUrl,
    error,
    setError,
    showCodeEditor,
    setShowCodeEditor,
    editedHtmlCss,
    setEditedHtmlCss,
    originalHtmlCss,
    isDirty,
    isRendering,
    handleClipDrop,
    handleRemoveClip,
    handleGenerate,
    handleRenderFromCode,
    handleApplyToTimeline,
    handleRePrompt,
    handleResetCode,
    resetAll,
  };
}
