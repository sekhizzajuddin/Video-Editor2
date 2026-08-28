import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { GenerativeResult, GenerativeMotionOptions } from '@/utils/generateMotionGraphicsFromDialogue';
import type { MediaItem, TimelineClip } from '@/types';

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
  const [step, setStep] = useState<GenerativeStep>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [result, setResult] = useState<GenerativeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCodeEditor, setShowCodeEditor] = useState<boolean>(false);
  const [editedHtmlCss, setEditedHtmlCss] = useState<string>('');
  const [originalHtmlCss, setOriginalHtmlCss] = useState<string>('');

  const abortControllerRef = useRef<AbortController | null>(null);

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
      setStep('extracting');
      setProgress(5);
      setProgressMessage('Starting generation pipeline...');

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
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
        };

        const genResult = await generateMotionGraphicsFromDialogue(
          mode === 'clip' ? selectedClipUrl : null,
          mode === 'clip' ? selectedClipDuration || 15 : targetDuration,
          genOptions,
          (currentStep: string, currentProgress: number) => {
            setStep(currentStep as GenerativeStep);
            setProgress(currentProgress);
            setProgressMessage(currentStep);
          }
        );

        setResult(genResult);
        const sceneHtml = genResult.spec?.htmlCssScenes?.[0]?.htmlCss || '';
        setEditedHtmlCss(sceneHtml);
        setOriginalHtmlCss(sceneHtml);
        setStep('done');
        setProgress(100);
        setProgressMessage('Generation complete');
        toast.success('Motion graphics generated successfully!');
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          setStep('idle');
          setProgress(0);
          setProgressMessage('');
          return;
        }
        const errMsg = err?.message || 'An error occurred during generation';
        setError(errMsg);
        setStep('error');
        setProgress(0);
        toast.error(errMsg);
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
    ]
  );

  const handleApplyToTimeline = useCallback(async () => {
    if (!result?.webmBlob) {
      toast.error('No motion graphic video available to apply');
      return;
    }

    try {
      const { useEditorStore } = await import('@/store/editorStore');
      const store = useEditorStore.getState();

      const mediaId = `gen_motion_${Date.now()}`;
      const blobUrl = URL.createObjectURL(result.webmBlob);
      const finalDuration =
        result.spec?.duration || (mode === 'clip' ? selectedClipDuration : targetDuration) || 15;
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
      };

      store.addMedia(mediaItem);

      store.addTrack('video');

      const updatedTracks = useEditorStore.getState().tracks;
      const videoTracks = updatedTracks.filter((t) => t.type === 'video');
      const targetTrack = videoTracks[videoTracks.length - 1] || updatedTracks[updatedTracks.length - 1];

      if (targetTrack) {
        const clipId = `clip_${Date.now()}`;
        const newClip: TimelineClip = {
          id: clipId,
          mediaId,
          trackId: targetTrack.id,
          startTime: store.currentTime || 0,
          duration: finalDuration,
          trimStart: 0,
          trimEnd: 0,
          transform: { x: 0, y: 0, scale: 1, rotation: 0 },
          opacity: 1,
          speed: 1,
          effects: [],
        };
        store.addClip(newClip);
        toast.success('Motion graphics added to timeline!');
      } else {
        toast.success('Motion graphics added to media library!');
      }
    } catch (err: any) {
      console.error('Failed to apply motion graphics to timeline:', err);
      toast.error('Failed to apply to timeline: ' + (err?.message || 'Unknown error'));
    }
  }, [result, mode, selectedClipDuration, targetDuration, selectedClipName, style]);

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
    setStep('idle');
    setProgress(0);
    setProgressMessage('');
    setResult(null);
    setError(null);
    setShowCodeEditor(false);
    setEditedHtmlCss('');
    setOriginalHtmlCss('');
  }, []);

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
    step,
    setStep,
    progress,
    setProgress,
    progressMessage,
    setProgressMessage,
    result,
    setResult,
    error,
    setError,
    showCodeEditor,
    setShowCodeEditor,
    editedHtmlCss,
    setEditedHtmlCss,
    originalHtmlCss,
    handleClipDrop,
    handleRemoveClip,
    handleGenerate,
    handleApplyToTimeline,
    handleRePrompt,
    handleResetCode,
    resetAll,
  };
}
