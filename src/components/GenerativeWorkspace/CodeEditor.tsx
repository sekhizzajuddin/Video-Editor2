import React, { useState, useEffect, useMemo } from 'react';
import { RotateCcw, Code, Eye, Terminal } from 'lucide-react';

export interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  originalCode: string;
  onReset: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  onChange,
  originalCode,
  onReset,
}) => {
  const [debouncedCode, setDebouncedCode] = useState(code);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCode(code);
    }, 300);
    return () => clearTimeout(timer);
  }, [code]);

  const previewDoc = useMemo(() => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #000000;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  ${debouncedCode}
</body>
</html>`;
  }, [debouncedCode]);

  const hasChanges = code !== originalCode;

  return (
    <div className="flex flex-col bg-[#141414] border border-[#3e3e3e] rounded-xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#1e1e1e] border-b border-[#3e3e3e]">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-white tracking-wide">
            Live HTML / CSS Scene Editor
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-[#a0a0a0]">
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-blue-400" /> Live Preview
          </span>
          <span className="flex items-center gap-1">
            <Terminal className="w-3.5 h-3.5 text-green-400" /> Terminal Code
          </span>
        </div>
      </div>

      {/* Split View */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#3e3e3e] h-80">
        {/* Left: Live Preview Iframe */}
        <div className="relative bg-black h-full flex flex-col">
          <div className="absolute top-2 left-2 z-10 bg-black/70 backdrop-blur px-2 py-0.5 rounded text-[10px] text-[#a0a0a0] border border-[#3e3e3e]">
            Live Canvas
          </div>
          <iframe
            srcDoc={previewDoc}
            title="Live Motion Preview"
            sandbox="allow-scripts"
            className="w-full h-full border-none bg-black"
          />
        </div>

        {/* Right: Code Textarea */}
        <div className="relative h-full flex flex-col bg-[#0d0d0d]">
          <div className="absolute top-2 right-2 z-10 bg-[#1e1e1e]/80 backdrop-blur px-2 py-0.5 rounded text-[10px] text-green-400 border border-[#3e3e3e] font-mono">
            HTML & CSS
          </div>
          <textarea
            value={code}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            className="w-full h-full p-3 pt-7 bg-[#0d0d0d] text-green-400 text-xs font-mono focus:outline-none resize-none selection:bg-green-900 selection:text-white leading-relaxed"
            style={{
              fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
              lineHeight: '1.5',
            }}
          />
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#1a1a1a] border-t border-[#3e3e3e]">
        <div className="text-[11px] text-[#a0a0a0]">
          {hasChanges ? (
            <span className="text-amber-400 font-medium">● Modified from AI version</span>
          ) : (
            <span>Original AI generation</span>
          )}
        </div>

        <button
          type="button"
          onClick={onReset}
          disabled={!hasChanges}
          className="flex items-center gap-1.5 px-3 py-1 text-xs rounded bg-[#252525] text-white hover:bg-[#2d2d2d] disabled:opacity-40 disabled:cursor-not-allowed border border-[#3e3e3e] transition-colors"
          title="Reset to original generated AI code"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to AI Code
        </button>
      </div>
    </div>
  );
};
