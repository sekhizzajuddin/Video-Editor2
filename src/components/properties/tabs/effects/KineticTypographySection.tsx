import React, { useState, useEffect } from 'react';
import { Type, Sparkles, Loader2, FileText, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import type { TimelineClip } from '@/types';
import { generateKineticTypography } from '@/utils/kineticTypography';
import { TEXT_TEMPLATES } from '@/utils/textTemplates';
import { toast } from 'sonner';

interface KineticTypographySectionProps {
  selectedClip: TimelineClip;
  aiProvider?: 'gemini' | 'groq';
}

export function KineticTypographySection({
  selectedClip,
  aiProvider = 'groq',
}: KineticTypographySectionProps) {
  // ── Core generation state ──────────────────────────────────────────────────
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // ── Config state ───────────────────────────────────────────────────────────
  const [kineticTypoScript, setKineticTypoScript] = useState('english');
  const [englishCasing, setEnglishCasing] = useState<'all_caps' | 'first_letter_caps' | 'none'>('none');
  const [kineticTypoStyle, setKineticTypoStyle] = useState<string>('random');
  const [kineticTypoAnimation, setKineticTypoAnimation] = useState<string>('random');
  const [kineticTypoProvider, setKineticTypoProvider] = useState<'gemini' | 'groq'>(aiProvider);
  const [kineticTypoType, setKineticTypoType] = useState<'word' | 'sentence' | 'hybrid'>('hybrid');
  const [kineticTypoLayout, setKineticTypoLayout] = useState<'row' | 'column'>('row');
  const [referenceScript, setReferenceScript] = useState('');
  const [showReferenceInput, setShowReferenceInput] = useState(false);

  // ── Custom AI Prompt ───────────────────────────────────────────────────────
  const [customPrompt, setCustomPrompt] = useState('');

  // ── Bug Fix: sync provider if parent aiProvider prop changes ──────────────
  useEffect(() => {
    setKineticTypoProvider(aiProvider);
  }, [aiProvider]);

  // ── Guard: kinetic typography only works on video/audio clips with real media
  const isTextClip = !!selectedClip.textSettings || selectedClip.mediaId === 'text-placeholder';

  // ── Generate handler ───────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (isTextClip) {
      toast.warning('Kinetic Typography requires a video or audio clip, not a text clip.');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      await generateKineticTypography(
        selectedClip,
        selectedClip.trackId || '',
        {
          script: kineticTypoScript,
          englishCasing,
          casing: englishCasing,
          styleSelection: kineticTypoStyle,
          animationSelection: kineticTypoAnimation,
          provider: kineticTypoProvider,
          typoType: kineticTypoType,
          typoLayout: kineticTypoLayout,
          referenceScript: referenceScript.trim(),
          customPrompt: customPrompt.trim(),
        },
        (p) => setProgress(Math.round(p))
      );
      toast.success(`Kinetic Typography (${kineticTypoType.toUpperCase()}) created and synced!`);
    } catch (err: any) {
      console.error('[Kinetic Typography] Generation failed:', err);
      toast.error(err?.message || 'Failed to generate kinetic typography.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-[#152323] border border-teal-500/30 rounded-lg shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer select-none hover:bg-teal-500/5 transition-colors"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-teal-500/20 text-teal-400 shrink-0">
            <Type className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
              AI Kinetic Typography
              <Sparkles className="w-3 h-3 text-teal-400" />
            </h4>
            <p className="text-[9px] text-[#90b8b8] leading-tight">
              Auto-transcribes &amp; syncs animated word overlays
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-teal-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-teal-400" />
          )}
        </div>
      </div>

      {/* ── Text clip incompatibility notice ── */}
      {isTextClip && (
        <div className="px-3 pb-3">
          <p className="text-[10px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5 leading-relaxed">
            ⚠️ Select a <strong>video or audio clip</strong> on the timeline to use Kinetic Typography. Text clips are not supported.
          </p>
        </div>
      )}

      {/* ── Collapsed summary + generate button ── */}
      {!isExpanded && !isTextClip && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            Extract spoken words and generate broadcast-ready kinetic typography synced to speech. Click to configure and generate.
          </p>
          {isGenerating ? (
            <div className="flex items-center justify-between py-2 px-3 bg-[#111a1a] border border-teal-500/20 rounded">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-teal-400 animate-spin" />
                <span className="text-[10px] text-teal-300">Generating kinetic words...</span>
              </div>
              <span className="text-xs font-bold text-teal-400 font-mono">{progress}%</span>
            </div>
          ) : (
            <button
              type="button"
              disabled={isGenerating}
              onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
              className="w-full py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-200" />
              Generate Kinetic Typography
            </button>
          )}
        </div>
      )}


      {/* ── Expanded config panel ── */}
      {isExpanded && (
        <div className="border-t border-teal-500/20">
          {/* Full-height expanded config area */}
          <div className="p-3 space-y-4">

            {/* Script / Language */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[#a0a0a0] uppercase font-bold tracking-wider">
                Script / Language
              </label>
              <select
                value={kineticTypoScript}
                onChange={(e) => setKineticTypoScript(e.target.value)}
                className="bg-[#151515] text-white text-xs border border-[#3e3e3e] rounded p-2 focus:outline-none focus:border-teal-500 w-full"
              >
                <option value="english">English</option>
                <option value="roman_urdu_hindi">Roman Urdu / Hindi</option>
                <option value="hindi">Devanagari Hindi (हिंदी)</option>
                <option value="spanish">Spanish</option>
                <option value="french">French</option>
                <option value="german">German</option>
              </select>
            </div>

            {/* AI Provider */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[#a0a0a0] uppercase font-bold tracking-wider flex justify-between items-center flex-wrap gap-1">
                <span>AI Reasoning Provider</span>
                {kineticTypoProvider === 'groq' && (
                  <span className="px-1.5 py-0.5 rounded text-[8px] bg-purple-500/20 text-purple-400 font-bold border border-purple-500/30">
                    LLaMA 3.3 (Text)
                  </span>
                )}
                {kineticTypoProvider === 'gemini' && (
                  <span className="px-1.5 py-0.5 rounded text-[8px] bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
                    Flash 2.0 (Vision)
                  </span>
                )}
              </label>
              <select
                value={kineticTypoProvider}
                onChange={(e) => setKineticTypoProvider(e.target.value as 'gemini' | 'groq')}
                className="bg-[#151515] text-white text-xs border border-[#3e3e3e] rounded p-2 focus:outline-none focus:border-teal-500 w-full"
              >
                <option value="groq">Groq (Faster, Advanced NLP & Timing)</option>
                <option value="gemini">Gemini (Analyzes Scene Video Frames)</option>
              </select>
            </div>

            {/* Typography Type */}
            <div className="flex flex-col gap-1.5 border-t border-[#2d2d2d] pt-3">
              <label className="text-[10px] text-[#a0a0a0] uppercase font-bold tracking-wider flex justify-between items-center flex-wrap gap-1">
                <span>Typography Type</span>
                <span className="px-1.5 py-0.5 rounded text-[8px] bg-teal-500/20 text-teal-400 font-bold border border-teal-500/30 uppercase">
                  {kineticTypoType}
                </span>
              </label>
              <select
                value={kineticTypoType}
                onChange={(e) => setKineticTypoType(e.target.value as 'word' | 'sentence' | 'hybrid')}
                className="bg-[#151515] text-white text-xs border border-[#3e3e3e] rounded p-2 focus:outline-none focus:border-teal-500 w-full font-medium"
              >
                <option value="hybrid">Hybrid (Sentence + Word Animate In)</option>
                <option value="word">Word by Word (Clip Per Word)</option>
                <option value="sentence">Sentence by Sentence (Full Sentence Clips)</option>
              </select>
              <p className="text-[10px] text-[#888] leading-tight">
                {kineticTypoType === 'hybrid' && 'Full sentence displayed while words animate in via PiP — no overlap.'}
                {kineticTypoType === 'word' && 'Individual word clips placed on timeline as each word is spoken.'}
                {kineticTypoType === 'sentence' && 'Complete sentence text clips added to timeline per spoken sentence.'}
              </p>
            </div>

            {/* Layout (conditional) */}
            {(kineticTypoType === 'hybrid' || kineticTypoType === 'sentence') && (
              <div className="flex flex-col gap-1.5 border-t border-[#2d2d2d] pt-3 animate-fadeIn">
                <label className="text-[10px] text-[#a0a0a0] uppercase font-bold tracking-wider flex justify-between items-center flex-wrap gap-1">
                  <span>Typography Layout</span>
                  <span className="px-1.5 py-0.5 rounded text-[8px] bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30 uppercase">
                    {kineticTypoLayout}
                  </span>
                </label>
                <select
                  value={kineticTypoLayout}
                  onChange={(e) => setKineticTypoLayout(e.target.value as 'row' | 'column')}
                  className="bg-[#151515] text-white text-xs border border-[#3e3e3e] rounded p-2 focus:outline-none focus:border-teal-500 w-full"
                >
                  <option value="row">Row (16:9 Landscape)</option>
                  <option value="column">Column (9:16 Shorts / Reels)</option>
                </select>
                <p className="text-[10px] text-[#888] leading-tight">
                  {kineticTypoLayout === 'row' && 'Text flows in wide lines — optimized for landscape videos.'}
                  {kineticTypoLayout === 'column' && 'Short punchy line breaks optimized for vertical short videos.'}
                </p>
              </div>
            )}

            {/* Reference Script */}
            <div className="space-y-2 border-t border-[#2d2d2d] pt-3">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setShowReferenceInput((v) => !v)}
                  className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1.5 focus:outline-none transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {showReferenceInput ? 'Hide Reference Script' : '+ Add Reference Script (Optional)'}
                </button>
                {referenceScript.trim() && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 font-mono">
                    Script Added
                  </span>
                )}
              </div>
              {showReferenceInput && (
                <div className="space-y-1.5 animate-fadeIn">
                  <textarea
                    value={referenceScript}
                    onChange={(e) => setReferenceScript(e.target.value)}
                    placeholder="Paste or type your exact ground-truth transcript/script here..."
                    rows={3}
                    className="w-full bg-[#151515] text-white text-xs border border-[#3e3e3e] rounded p-2 focus:outline-none focus:border-teal-500 font-mono resize-none"
                  />
                  <p className="text-[10px] text-[#888] leading-tight">
                    Provides exact ground-truth words to AI — helps with strong accents or background noise.
                  </p>
                </div>
              )}
            </div>

            {/* Casing (English / Roman Urdu only) */}
            {(kineticTypoScript === 'english' || kineticTypoScript === 'roman_urdu_hindi') && (
              <div className="space-y-2 border-t border-[#2d2d2d] pt-3">
                <label className="text-[10px] text-[#a0a0a0] uppercase font-bold tracking-wider block">
                  Casing Constraints
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-2 bg-[#151515] border border-[#2d2d2d] rounded cursor-pointer text-xs select-none hover:border-teal-500/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={englishCasing === 'all_caps'}
                      onChange={(e) => setEnglishCasing(e.target.checked ? 'all_caps' : 'none')}
                      className="w-3.5 h-3.5 rounded border-[#3e3e3e] bg-[#2a2a2a] text-teal-500 focus:ring-teal-500 focus:ring-offset-[#1e1e1e]"
                    />
                    <span className="text-white text-[10px] font-medium">ALL CAPS</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 bg-[#151515] border border-[#2d2d2d] rounded cursor-pointer text-xs select-none hover:border-teal-500/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={englishCasing === 'first_letter_caps'}
                      onChange={(e) => setEnglishCasing(e.target.checked ? 'first_letter_caps' : 'none')}
                      className="w-3.5 h-3.5 rounded border-[#3e3e3e] bg-[#2a2a2a] text-teal-500 focus:ring-teal-500 focus:ring-offset-[#1e1e1e]"
                    />
                    <span className="text-white text-[10px] font-medium">First Letter Caps</span>
                  </label>
                </div>
              </div>
            )}

            {/* Style Selection */}
            <div className="flex flex-col gap-1.5 border-t border-[#2d2d2d] pt-3">
              <label className="text-[10px] text-[#a0a0a0] uppercase font-bold tracking-wider">
                Style Selection
              </label>
              <select
                value={kineticTypoStyle}
                onChange={(e) => setKineticTypoStyle(e.target.value)}
                className="bg-[#151515] text-white text-xs border border-[#3e3e3e] rounded p-2 focus:outline-none focus:border-teal-500 w-full"
              >
                <option value="random">AI / Random Style Presets</option>
                {TEXT_TEMPLATES.map((t) => (
                  <option key={t.name} value={t.name}>
                    Specific: {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Animation Selection */}
            <div className="flex flex-col gap-1.5 border-t border-[#2d2d2d] pt-3">
              <label className="text-[10px] text-[#a0a0a0] uppercase font-bold tracking-wider">
                Animation Selection
              </label>
              <select
                value={kineticTypoAnimation}
                onChange={(e) => setKineticTypoAnimation(e.target.value)}
                className="bg-[#151515] text-white text-xs border border-[#3e3e3e] rounded p-2 focus:outline-none focus:border-teal-500 w-full"
              >
                <option value="random">AI / Random Animations</option>
                <option value="zoom">Specific: Pop / Zoom</option>
                <option value="bounce">Specific: Bounce</option>
                <option value="slideUp">Specific: Slide Up</option>
                <option value="slideDown">Specific: Slide Down</option>
                <option value="slideLeft">Specific: Slide Left</option>
                <option value="slideRight">Specific: Slide Right</option>
                <option value="fadeIn">Specific: Fade In</option>
                <option value="typewriter">Specific: Typewriter</option>
              </select>
            </div>

            {/* ── Custom AI Prompt ── */}
            <div className="flex flex-col gap-2 border-t border-teal-500/20 pt-3">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <label className="text-[10px] text-teal-300 uppercase font-bold tracking-wider">
                  Custom AI Instruction
                </label>
              </div>
              <p className="text-[10px] text-[#888] leading-relaxed">
                Give the AI a custom instruction it will follow before generating — e.g., text position, multi-design style, emphasis on specific words, mood, color theme, or any creative direction.
              </p>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder={`e.g., "Position all text at the bottom-center. Use a bold neon style for emphasis words. Keep the mood energetic and punchy."`}
                rows={4}
                className="w-full bg-[#111a1a] text-white text-xs border border-teal-500/30 rounded-lg p-2.5 focus:outline-none focus:border-teal-400 font-mono resize-none placeholder:text-[#446060] leading-relaxed"
              />
              {customPrompt.trim() && (
                <div className="flex items-center justify-between">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 font-mono">
                    Custom instruction active
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomPrompt('')}
                    className="text-[9px] text-[#888] hover:text-red-400 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── Generate button (sticky at bottom) ── */}
          <div className="p-3 border-t border-teal-500/20 bg-[#0f1e1e]">
            {isGenerating ? (
              <div className="flex items-center justify-between py-2 px-3 bg-[#111a1a] border border-teal-500/20 rounded">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-teal-400 animate-spin" />
                  <span className="text-[10px] text-teal-300">Generating kinetic words...</span>
                </div>
                <span className="text-xs font-bold text-teal-400 font-mono">{progress}%</span>
              </div>
            ) : (
              <button
                type="button"
                disabled={isGenerating || isTextClip}
                onClick={handleGenerate}
                className="w-full py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[12px] font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-200" />
                Generate Kinetic Typography
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
