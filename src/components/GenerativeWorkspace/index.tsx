import React from 'react';
import { Sparkles, Film, Type, Wand2, AlertCircle, Loader2 } from 'lucide-react';
import { useGenerativeWorkspace } from './useGenerativeWorkspace';
import { ClipDropZone } from './ClipDropZone';
import { DialogueEditor } from './DialogueEditor';
import { MotionStyleControls } from './MotionStyleControls';
import { GenerationProgress } from './GenerationProgress';
import { ResultPreview } from './ResultPreview';

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
    step,
    progress,
    progressMessage,
    result,
    error,
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
  } = useGenerativeWorkspace();

  const isGenerating =
    step !== 'idle' && step !== 'done' && step !== 'error';

  const isGenerateDisabled =
    isGenerating ||
    (mode === 'clip' && !selectedClipUrl) ||
    (mode === 'text' && !dialogueText.trim());

  return (
    <div
      className={`h-full flex flex-col bg-[#1e1e1e] text-white p-4 overflow-y-auto space-y-4 custom-scrollbar ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-[#3e3e3e] pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎬</span>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                Generative Motion Graphics
                <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400/20" />
              </h2>
              <p className="text-xs text-[#a0a0a0]">
                Transform dialogue & scripts into kinetic visuals with AI
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-[#141414] rounded-lg border border-[#3e3e3e]">
          <button
            type="button"
            onClick={() => setMode('clip')}
            className={`flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-semibold transition-all ${
              mode === 'clip'
                ? 'bg-[#252525] text-amber-400 shadow border border-amber-400/30'
                : 'text-[#a0a0a0] hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            Clip Mode
          </button>
          <button
            type="button"
            onClick={() => setMode('text')}
            className={`flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-semibold transition-all ${
              mode === 'text'
                ? 'bg-[#252525] text-amber-400 shadow border border-amber-400/30'
                : 'text-[#a0a0a0] hover:text-white'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            Text-to-Motion
          </button>
        </div>
      </div>

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
            <span>Generating Motion Graphics...</span>
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

      {/* Generation Progress */}
      {isGenerating && (
        <GenerationProgress
          step={step}
          progress={progress}
          message={progressMessage}
        />
      )}

      {/* Result Preview & Code Editor */}
      {result && !isGenerating && (
        <ResultPreview
          result={result}
          onRePrompt={handleRePrompt}
          onApply={handleApplyToTimeline}
          showCodeEditor={showCodeEditor}
          setShowCodeEditor={setShowCodeEditor}
          editedHtmlCss={editedHtmlCss}
          setEditedHtmlCss={setEditedHtmlCss}
          originalHtmlCss={originalHtmlCss}
          onResetCode={handleResetCode}
        />
      )}
    </div>
  );
};

export default GenerativeWorkspace;
