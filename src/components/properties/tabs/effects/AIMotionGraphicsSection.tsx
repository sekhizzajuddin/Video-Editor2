import React, { useState } from 'react';
import { Sparkles, Loader2, Type, ChevronDown, ChevronUp, Play } from 'lucide-react';
import type { TimelineClip } from '@/types';
import { generateKineticTypography } from '@/utils/kineticTypography';
import { toast } from 'sonner';

interface AIMotionGraphicsSectionProps {
  aiProvider: 'gemini' | 'groq';
  setAiProvider: (v: 'gemini' | 'groq') => void;
  isAnalyzingMotionGraphics: boolean;
  motionGraphicsAnalyzeProgress: string;
  handleAiMotionGraphicsDesign: () => void;
  selectedClip?: TimelineClip;
}

export function AIMotionGraphicsSection({
  aiProvider,
  setAiProvider,
  isAnalyzingMotionGraphics,
  motionGraphicsAnalyzeProgress,
  handleAiMotionGraphicsDesign,
  selectedClip,
}: AIMotionGraphicsSectionProps) {
  const [showKineticConfig, setShowKineticConfig] = useState(false);
  const [typoMode, setTypoMode] = useState<'word' | 'sentence' | 'hybrid'>('hybrid');
  const [typoLayout, setTypoLayout] = useState<'row' | 'column'>('row');
  const [script, setScript] = useState('english');
  const [casing, setCasing] = useState<'all_caps' | 'first_letter_caps' | 'none'>('none');
  const [stylePreset, setStylePreset] = useState<string>('random');
  const [animationPreset, setAnimationPreset] = useState<string>('random');
  const [isGeneratingKinetic, setIsGeneratingKinetic] = useState(false);
  const [kineticProgress, setKineticProgress] = useState(0);

  const handleGenerateKinetic = async () => {
    if (!selectedClip) {
      toast.error('Please select an active clip on the timeline first.');
      return;
    }

    setIsGeneratingKinetic(true);
    setKineticProgress(0);

    try {
      await generateKineticTypography(
        selectedClip,
        selectedClip.trackId || '',
        {
          script,
          casing,
          styleSelection: stylePreset,
          animationSelection: animationPreset,
          provider: aiProvider,
          typoType: typoMode,
          typoLayout: typoLayout,
        },
        (p) => setKineticProgress(Math.round(p))
      );
      toast.success(`Kinetic Typography (${typoMode.toUpperCase()}) generated successfully!`);
      setShowKineticConfig(false);
    } catch (err: any) {
      console.error('[Kinetic Typography] Error:', err);
      toast.error(err?.message || 'Failed to generate kinetic typography.');
    } finally {
      setIsGeneratingKinetic(false);
    }
  };

  return (
    <div className="bg-[#142323] border border-teal-500/30 rounded p-3 space-y-3 shadow-sm transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-400 animate-pulse" />
          <span className="text-xs text-white font-semibold tracking-wide">AI Motion & Typography Gen</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-teal-300 font-medium">Provider:</span>
          <select
            value={aiProvider}
            onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'groq')}
            className="bg-[#1a2c2c] hover:bg-[#203636] text-white text-[10px] font-semibold border border-teal-500/40 rounded px-1.5 py-0.5 focus:outline-none focus:border-teal-400 transition-colors"
          >
            <option value="gemini">Gemini AI</option>
            <option value="groq">Groq (Whisper)</option>
          </select>
        </div>
      </div>

      <p className="text-[11px] text-[#90b8b8] leading-relaxed">
        Generate dynamic motion graphics overlays or professional audio-aligned kinetic typography for this clip.
      </p>

      {/* Primary Action Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        {/* Motion Graphics Trigger */}
        {isAnalyzingMotionGraphics ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-2 bg-[#1e2828] rounded border border-teal-500/30">
            <Loader2 className="w-3.5 h-3.5 text-teal-400 animate-spin" />
            <span className="text-[10px] text-teal-300 font-medium truncate w-full text-center px-1">
              {motionGraphicsAnalyzeProgress || 'Analyzing...'}
            </span>
          </div>
        ) : (
          <button
            onClick={handleAiMotionGraphicsDesign}
            className="flex items-center justify-center gap-1.5 py-2 bg-[#203232] hover:bg-[#283e3e] active:bg-[#1a2828] text-white rounded text-[11px] font-medium border border-teal-500/30 hover:border-teal-400/60 transition-all duration-150 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>Motion Graphics</span>
          </button>
        )}

        {/* Kinetic Typography Config Toggle */}
        <button
          onClick={() => setShowKineticConfig(!showKineticConfig)}
          className={`flex items-center justify-center gap-1.5 py-2 rounded text-[11px] font-medium border transition-all duration-150 shadow-sm ${
            showKineticConfig
              ? 'bg-teal-600/30 border-teal-400 text-teal-200 shadow-teal-900/30'
              : 'bg-[#203232] hover:bg-[#283e3e] active:bg-[#1a2828] text-white border-teal-500/30 hover:border-teal-400/60'
          }`}
        >
          <Type className="w-3.5 h-3.5 text-amber-400" />
          <span>Kinetic Typography</span>
          {showKineticConfig ? <ChevronUp className="w-3 h-3 ml-0.5 text-teal-400" /> : <ChevronDown className="w-3 h-3 ml-0.5 text-[#888]" />}
        </button>
      </div>

      {/* Kinetic Typography Configuration Panel */}
      {showKineticConfig && (
        <div className="mt-2 pt-3 border-t border-teal-500/30 space-y-3 bg-[#0d1717]/80 rounded p-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-amber-400" /> Typography Generator
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 font-mono font-medium uppercase border border-teal-500/30">
              {typoMode} Mode
            </span>
          </div>

          {/* Mode Selector (Word, Sentence, Hybrid) */}
          <div className="space-y-1">
            <label className="block text-[10px] font-semibold text-white uppercase tracking-wider">
              Animation Mode <span className="text-amber-400/90 lowercase font-normal">(required)</span>
            </label>
            <select
              value={typoMode}
              onChange={(e) => setTypoMode(e.target.value as 'word' | 'sentence' | 'hybrid')}
              disabled={isGeneratingKinetic}
              className="bg-[#152020] hover:bg-[#1a2626] text-white text-[11px] font-medium border border-teal-500/40 rounded px-2.5 py-1.5 focus:outline-none focus:border-amber-400 w-full transition-colors"
            >
              <option value="hybrid">✨ Hybrid Mode (Full Sentence PiP, Words Animate In)</option>
              <option value="word">🔤 Word by Word (Separate Timed Clip Per Word)</option>
              <option value="sentence">📝 Sentence by Sentence (Complete Phrase Clips)</option>
            </select>
            <p className="text-[10px] text-[#8aa8a8] italic leading-tight pt-0.5">
              {typoMode === 'hybrid' && 'Recommended: Full sentence container holds individual animating words inside multi-track PiP without timeline clutter or overlap.'}
              {typoMode === 'word' && 'Fast & energetic: Places individual word clips sequentially along a new timeline track as each word is uttered.'}
              {typoMode === 'sentence' && 'Clean captions: Groups words naturally into full sentences placed neatly as lower-third subtitle clips.'}
            </p>
          </div>

          {/* Typography Layout Selector (Row vs Column) */}
          {(typoMode === 'hybrid' || typoMode === 'sentence') && (
            <div className="space-y-1 animate-in fade-in pt-1 border-t border-teal-500/20 mt-2">
              <label className="block text-[10px] font-semibold text-white uppercase tracking-wider">
                Typography Layout <span className="text-indigo-400 lowercase font-normal">(16:9 vs 9:16)</span>
              </label>
              <select
                value={typoLayout}
                onChange={(e) => setTypoLayout(e.target.value as 'row' | 'column')}
                disabled={isGeneratingKinetic}
                className="bg-[#152020] hover:bg-[#1a2626] text-white text-[11px] font-medium border border-teal-500/40 rounded px-2.5 py-1.5 focus:outline-none focus:border-amber-400 w-full transition-colors"
              >
                <option value="row">Row Wise (16:9 Landscape Video)</option>
                <option value="column">Column Wise (9:16 Short Video / Reel)</option>
              </select>
              <p className="text-[10px] text-[#8aa8a8] italic leading-tight pt-0.5">
                {typoLayout === 'row' && "Line breaks are added intelligently so text does not exceed 16:9 width."}
                {typoLayout === 'column' && "AI adds excellent, punchy line breaks specifically optimized for vertical short videos."}
              </p>
            </div>
          )}

          {/* Language & Casing Settings */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[10px] text-[#b0d0d0] font-medium mb-1">Language / Script</label>
              <select
                value={script}
                onChange={(e) => setScript(e.target.value)}
                disabled={isGeneratingKinetic}
                className="bg-[#152020] text-white text-[10px] border border-teal-500/30 rounded p-1.5 w-full focus:outline-none focus:border-amber-400"
              >
                <option value="english">English</option>
                <option value="hindi">Devanagari (Hindi)</option>
                <option value="roman_urdu_hindi">Roman Urdu/Hindi</option>
                <option value="spanish">Spanish</option>
                <option value="french">French</option>
                <option value="german">German</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-[#b0d0d0] font-medium mb-1">Text Casing</label>
              <select
                value={casing}
                onChange={(e) => setCasing(e.target.value as 'all_caps' | 'first_letter_caps' | 'none')}
                disabled={isGeneratingKinetic}
                className="bg-[#152020] text-white text-[10px] border border-teal-500/30 rounded p-1.5 w-full focus:outline-none focus:border-amber-400"
              >
                <option value="none">Natural (Default)</option>
                <option value="all_caps">ALL CAPS</option>
                <option value="first_letter_caps">Title Case</option>
              </select>
            </div>
          </div>

          {/* Style & Animation Presets */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[10px] text-[#b0d0d0] font-medium mb-1">Visual Style</label>
              <select
                value={stylePreset}
                onChange={(e) => setStylePreset(e.target.value)}
                disabled={isGeneratingKinetic}
                className="bg-[#152020] text-white text-[10px] border border-teal-500/30 rounded p-1.5 w-full focus:outline-none focus:border-amber-400"
              >
                <option value="random">🎨 AI Emotional Select (Random)</option>
                <option value="MrBeast Hype">MrBeast Hype</option>
                <option value="Alex Hormozi Impact">Alex Hormozi Impact</option>
                <option value="Modern Shorts Pill">Modern Shorts Pill</option>
                <option value="Neon Cyberpunk">Neon Cyberpunk</option>
                <option value="Yellow Warning">Yellow Warning</option>
                <option value="Golden Glow">Golden Glow</option>
                <option value="Bouncy Pop">Bouncy Pop</option>
                <option value="Bubble Caption">Bubble Caption</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-[#b0d0d0] font-medium mb-1">Animation In</label>
              <select
                value={animationPreset}
                onChange={(e) => setAnimationPreset(e.target.value)}
                disabled={isGeneratingKinetic}
                className="bg-[#152020] text-white text-[10px] border border-teal-500/30 rounded p-1.5 w-full focus:outline-none focus:border-amber-400"
              >
                <option value="random">⚡ AI Cinema Selection</option>
                <option value="elastic">Spring Elastic Pop</option>
                <option value="splitReveal">Split Title Reveal</option>
                <option value="zoomBlur">Blockbuster Zoom</option>
                <option value="scaleFlip">Scale Flip Snap</option>
                <option value="glitch">Glitch Cyber Jitter</option>
                <option value="bounce">Bouncy Pop In</option>
                <option value="slideUp">Slide Up</option>
              </select>
            </div>
          </div>

          {/* Generate Button & Progress */}
          <div className="pt-2">
            {isGeneratingKinetic ? (
              <div className="space-y-1.5 bg-[#121c1c] p-2 rounded border border-amber-400/30">
                <div className="flex items-center justify-between text-[10px] font-medium text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    Generating {typoMode} typography...
                  </span>
                  <span className="font-mono text-xs font-bold text-amber-400">{kineticProgress}%</span>
                </div>
                <div className="w-full bg-[#1a2828] h-1.5 rounded-full overflow-hidden border border-teal-900/40">
                  <div
                    className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 h-full transition-all duration-200"
                    style={{ width: `${kineticProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <button
                onClick={handleGenerateKinetic}
                className="w-full py-2 bg-gradient-to-r from-amber-500/20 via-amber-500/30 to-amber-500/20 hover:from-amber-500/30 hover:to-amber-500/30 text-amber-300 hover:text-amber-200 font-bold text-xs rounded border border-amber-400/50 hover:border-amber-300 transition-all duration-150 shadow-md flex items-center justify-center gap-2"
              >
                <Play className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>Generate {typoMode === 'hybrid' ? 'Hybrid' : typoMode === 'word' ? 'Word' : 'Sentence'} Typography</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}