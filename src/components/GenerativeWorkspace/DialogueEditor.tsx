import React, { useMemo } from 'react';

export interface DialogueEditorProps {
  value: string;
  onChange: (val: string) => void;
  mode: 'clip' | 'text';
  disabled?: boolean;
}

export const DialogueEditor: React.FC<DialogueEditorProps> = ({
  value,
  onChange,
  mode,
  disabled = false,
}) => {
  const { wordCount, charCount } = useMemo(() => {
    const trimmed = value.trim();
    const words = trimmed.length > 0 ? trimmed.split(/\s+/).length : 0;
    return {
      wordCount: words,
      charCount: value.length,
    };
  }, [value]);

  const placeholder =
    mode === 'clip'
      ? 'AI will transcribe the audio, or type/paste your script here...'
      : 'Type or paste your dialogue script here...';

  return (
    <div className="flex flex-col space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#a0a0a0]">
          Dialogue / Script
        </label>
        {mode === 'clip' && (
          <span className="text-[11px] text-amber-400/90 font-medium">
            (Optional if clip has audio)
          </span>
        )}
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full h-32 bg-[#1a1a1a] border border-[#3e3e3e] rounded-lg p-3 text-sm text-white placeholder-[#606060] resize-none focus:outline-none focus:border-amber-400 transition disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed"
      />

      <div className="flex items-center justify-between text-xs text-[#a0a0a0] px-1">
        <span>
          <strong className="text-white font-medium">{wordCount}</strong> {wordCount === 1 ? 'word' : 'words'}
        </span>
        <span>
          <strong className="text-white font-medium">{charCount}</strong> characters
        </span>
      </div>
    </div>
  );
};
