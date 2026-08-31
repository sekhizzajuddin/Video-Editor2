import React, { useState } from 'react';
import {
  Sparkles,
  Film,
  Type,
  AlertCircle,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelBottomClose,
  PanelBottomOpen,
} from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useGenerativeWorkspace } from './useGenerativeWorkspace';
import { ClipDropZone } from './ClipDropZone';
import { DialogueEditor } from './DialogueEditor';
import { MotionStyleControls } from './MotionStyleControls';
import { GenerationProgress } from './GenerationProgress';
import { ResultPreview } from './ResultPreview';
import { DiagnosticsPanel } from './DiagnosticsPanel';

export interface GenerativeWorkspaceProps {
  className?: string;
}

export const GenerativeWorkspace: React.FC<GenerativeWorkspaceProps> = ({
  className = '',
}) => {
  const {
    mode,
    setMode,
    selectedClipUrl,
    selectedClipName,
    selectedClipDuration,
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
    progress,
    progressMessage,
    result,
    motionVideoUrl,
    error,
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
  } = useGenerativeWorkspace();

  // Layout: the theater needs every pixel it can get, so both the control rail
  // and the editor timeline can be folded away while reviewing a result.
  const [controlsOpen, setControlsOpen] = useState(true);
  const timelineHeight = useEditorStore((s) => s.workspaceLayout.timelineHeight);
  const setWorkspaceLayout = useEditorStore((s) => s.setWorkspaceLayout);
  const timelineHidden = timelineHeight <= 1;
  const toggleTimeline = () =>
    setWorkspaceLayout({
      ...useEditorStore.getState().workspaceLayout,
      preset: 'Custom',
      timelineHeight: timelineHidden ? 240 : 0,
    });

  const isGenerating =
    isRendering || (step !== 'idle' && step !== 'done' && step !== 'error');

  const isGenerateDisabled =
    isGenerating ||
    (mode === 'clip' && !selectedClipUrl) ||
    (mode === 'text' && !dialogueText.trim());

  return (
    <div className={`h-full flex flex-col md:flex-row bg-card text-foreground overflow-hidden ${className}`}>
      {/* Left Column: Motion Controls & Studio Configuration (collapsible rail) */}
      <div
        className={`${
          controlsOpen ? 'w-full md:w-[360px] xl:w-[400px]' : 'w-11'
        } shrink-0 border-b md:border-b-0 md:border-r border-border bg-background flex flex-col h-full overflow-hidden transition-[width] duration-200`}
      >
        {!controlsOpen ? (
          <button
            type="button"
            onClick={() => setControlsOpen(true)}
            className="flex-1 flex flex-col items-center gap-3 py-3 text-muted-foreground/80 hover:text-foreground transition-colors"
            title="Show motion controls"
          >
            <PanelLeftOpen className="w-4 h-4" />
            <span
              className="text-[11px] font-semibold tracking-wider uppercase"
              style={{ writingMode: 'vertical-rl' }}
            >
              Controls
            </span>
          </button>
        ) : (
          <>
        {/* Header */}
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-xl">🎬</span>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                Generative Motion Graphics
                <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
              </h2>
              <p className="text-[11px] text-muted-foreground">
                AI-powered vector scene &amp; kinetic type animator
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleTimeline}
                className="p-1.5 rounded hover:bg-secondary text-muted-foreground/80 hover:text-foreground transition-colors"
                title={timelineHidden ? 'Show editor timeline' : 'Hide editor timeline (focus preview)'}
              >
                {timelineHidden ? (
                  <PanelBottomOpen className="w-4 h-4" />
                ) : (
                  <PanelBottomClose className="w-4 h-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setControlsOpen(false)}
                className="p-1.5 rounded hover:bg-secondary text-muted-foreground/80 hover:text-foreground transition-colors"
                title="Hide motion controls (full-width preview)"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="grid grid-cols-2 p-1 bg-background rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setMode('clip')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                mode === 'clip'
                  ? 'bg-secondary text-amber-400 shadow-sm border border-amber-400/30'
                  : 'text-muted-foreground/80 hover:text-foreground'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              Clip Mode
            </button>
            <button
              type="button"
              onClick={() => setMode('text')}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                mode === 'text'
                  ? 'bg-secondary text-amber-400 shadow-sm border border-amber-400/30'
                  : 'text-muted-foreground/80 hover:text-foreground'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              Text-to-Motion
            </button>
          </div>
        </div>

        {/* Scrollable Configuration Controls */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {/* Clip Drop Zone (Clip Mode only) */}
          {mode === 'clip' && (
            <ClipDropZone
              onClipDrop={handleClipDrop}
              selectedClipName={selectedClipName}
              selectedClipUrl={selectedClipUrl}
              selectedClipDuration={selectedClipDuration}
              onRemove={handleRemoveClip}
            />
          )}

          {/* Dialogue / Script Input */}
          <DialogueEditor
            value={dialogueText}
            onChange={setDialogueText}
            mode={mode}
            disabled={isGenerating}
          />

          {/* Style & Generation Controls */}
          <MotionStyleControls
            style={style}
            setStyle={setStyle}
            layout={layout}
            setLayout={setLayout}
            provider={provider}
            setProvider={setProvider}
            customPrompt={customPrompt}
            setCustomPrompt={setCustomPrompt}
            targetDuration={targetDuration}
            setTargetDuration={setTargetDuration}
            mode={mode}
            transparent={transparent}
            setTransparent={setTransparent}
          />

          {/* Full-width Generate Button */}
          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={isGenerateDisabled}
            className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>{isRendering ? 'Rendering scene...' : 'Generating Motion Graphics...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 fill-black" />
                <span>Generate Motion Graphics</span>
              </>
            )}
          </button>

          {/* Error Alert Box */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Generation Failed</p>
                <p className="opacity-90">{error}</p>
              </div>
            </div>
          )}

          {/* Generation Progress Pipeline */}
          {isGenerating && (
            <GenerationProgress
              step={step}
              progress={progress}
              message={progressMessage}
            />
          )}

          {/* Pipeline self-test (no AI call) */}
          <DiagnosticsPanel
            sceneHtml={result?.spec?.htmlCssScenes?.[0]?.htmlCss ?? null}
            onLoadDemo={(html) => {
              setEditedHtmlCss(html);
              setShowCodeEditor(true);
            }}
          />
        </div>
          </>
        )}
      </div>

      {/* Right Column: Full-Size Preview Theater Screen */}
      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden p-2 sm:p-3 bg-background">
        <ResultPreview
          result={result}
          motionVideoUrl={motionVideoUrl}
          selectedClipUrl={selectedClipUrl}
          selectedClipName={selectedClipName}
          selectedClipDuration={selectedClipDuration}
          isGenerating={isGenerating}
          isRendering={isRendering}
          onRePrompt={handleRePrompt}
          onApply={handleApplyToTimeline}
          showCodeEditor={showCodeEditor}
          setShowCodeEditor={setShowCodeEditor}
          editedHtmlCss={editedHtmlCss}
          setEditedHtmlCss={setEditedHtmlCss}
          originalHtmlCss={originalHtmlCss}
          isDirty={isDirty}
          onRenderFromCode={handleRenderFromCode}
          onResetCode={handleResetCode}
        />
      </div>
    </div>
  );
};

export default GenerativeWorkspace;
