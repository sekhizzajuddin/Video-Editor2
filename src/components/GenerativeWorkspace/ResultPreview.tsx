import React, { useState, useEffect, useMemo } from 'react';
import { Play, Sparkles, Code2, Send, Plus, Film, ChevronDown, ChevronUp } from 'lucide-react';
import type { GenerativeResult } from '@/utils/generateMotionGraphicsFromDialogue';
import { CodeEditor } from './CodeEditor';

export interface ResultPreviewProps {
  result: GenerativeResult | null;
  onRePrompt: (prompt: string) => void;
  onApply: () => void;
  showCodeEditor: boolean;
  setShowCodeEditor: (show: boolean | ((prev: boolean) => boolean)) => void;
  editedHtmlCss: string;
  setEditedHtmlCss: (val: string) => void;
  originalHtmlCss: string;
  onResetCode: () => void;
}

export const ResultPreview: React.FC<ResultPreviewProps> = ({
  result,
  onRePrompt,
  onApply,
  showCodeEditor,
  setShowCodeEditor,
  editedHtmlCss,
  setEditedHtmlCss,
  originalHtmlCss,
  onResetCode,
}) => {
  const [isRePromptOpen, setIsRePromptOpen] = useState(false);
  const [rePromptText, setRePromptText] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (result?.webmBlob && result.webmBlob.size > 0) {
      const url = URL.createObjectURL(result.webmBlob);
      setVideoUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setVideoUrl(null);
    }
  }, [result]);

  const handleSendRePrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (rePromptText.trim()) {
      onRePrompt(rePromptText.trim());
      setRePromptText('');
      setIsRePromptOpen(false);
    }
  };

  if (!result) {
    return null;
  }

  return (
    <div className="bg-[#252525] border border-[#3e3e3e] rounded-xl p-4 space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-[#3e3e3e] pb-3">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Generated Motion Graphics</h3>
        </div>
        <span className="text-xs font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
          {result.spec?.duration ? `${result.spec.duration.toFixed(1)}s` : 'Ready'}
        </span>
      </div>

      {/* Video / Animation Preview Box */}
      <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center border border-[#3e3e3e]">
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            autoPlay
            loop
            className="w-full h-full object-contain"
          />
        ) : editedHtmlCss ? (
          <iframe
            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;}html,body{margin:0;padding:0;width:100%;height:100%;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;}</style></head><body>${editedHtmlCss}</body></html>`}
            title="Generated Preview"
            sandbox="allow-scripts"
            className="w-full h-full border-none pointer-events-none"
          />
        ) : (
          <div className="text-center p-6">
            <Play className="w-8 h-8 text-[#606060] mx-auto mb-2" />
            <p className="text-xs text-[#a0a0a0]">Motion graphics generated</p>
          </div>
        )}
      </div>

      {/* Action Buttons Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCodeEditor((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showCodeEditor
                ? 'bg-amber-400/10 text-amber-400 border-amber-400/40'
                : 'bg-[#1a1a1a] text-[#a0a0a0] hover:text-white border-[#3e3e3e]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Code ✏️
            {showCodeEditor ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <button
            type="button"
            onClick={() => setIsRePromptOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isRePromptOpen
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/40'
                : 'bg-[#1a1a1a] text-[#a0a0a0] hover:text-white border-[#3e3e3e]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Re-Prompt
          </button>
        </div>

        <button
          type="button"
          onClick={onApply}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-black shadow-md shadow-amber-400/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Apply to Timeline
        </button>
      </div>

      {/* Re-Prompt Inline Bar */}
      {isRePromptOpen && (
        <form
          onSubmit={handleSendRePrompt}
          className="flex items-center gap-2 p-2 bg-[#1a1a1a] rounded-lg border border-purple-500/30"
        >
          <input
            type="text"
            value={rePromptText}
            onChange={(e) => setRePromptText(e.target.value)}
            placeholder="Describe changes... e.g. 'make text bounce faster with neon blue glow'"
            autoFocus
            className="flex-1 bg-transparent text-xs text-white placeholder-[#606060] focus:outline-none px-2 py-1"
          />
          <button
            type="submit"
            disabled={!rePromptText.trim()}
            className="flex items-center gap-1 px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white rounded text-xs font-medium transition-colors"
          >
            <Send className="w-3 h-3" />
            Send
          </button>
        </form>
      )}

      {/* Embedded Code Editor */}
      {showCodeEditor && (
        <div className="pt-2">
          <CodeEditor
            code={editedHtmlCss}
            onChange={setEditedHtmlCss}
            originalCode={originalHtmlCss}
            onReset={onResetCode}
          />
        </div>
      )}
    </div>
  );
};
