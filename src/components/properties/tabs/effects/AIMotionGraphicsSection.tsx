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
    <div className="bg-[var(--theme-bg-card)] border border-teal-500/30 rounded-xl p-3.5 space-y-3 shadow-sm transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-500 animate-pulse" />
          <span className="text-xs text-[var(--theme-text-primary)] font-bold tracking-wide">AI Motion & Typography</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--theme-text-muted)] font-medium">Provider:</span>
          <select
            value={aiProvider}
            onChange={(e) => setAiProvider(e.target.value as 'gemini' | 'groq')}
            className="bg-[var(--theme-bg-subpanel)] text-[var(--theme-text-primary)] text-[10px] font-semibold border border-[var(--theme-border)] rounded-md px-2 py-0.5 focus:outline-none focus:border-teal-500 shadow-sm"
          >
            <option value="gemini">Gemini AI</option>
            <option value="groq">Groq (Whisper)</option>
          </select>
        </div>
      </div>

      <p className="text-[11px] text-[var(--theme-text-muted)] leading-relaxed">
        Generate dynamic motion graphics overlays or professional audio-aligned kinetic typography for this clip.
      </p>

      {/* Primary Action Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        {/* Motion Graphics Trigger */}
        {isAnalyzingMotionGraphics ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-2 bg-teal-500/10 rounded-lg border border-teal-500/30">
            <Loader2 className="w-3.5 h-3.5 text-teal-500 animate-spin" />
            <span className="text-[10px] text-teal-600 dark:text-teal-300 font-semibold truncate w-full text-center px-1">
              {motionGraphicsAnalyzeProgress || 'Analyzing...'}
            </span>
          </div>
        ) : (
          <button
            onClick={handleAiMotionGraphicsDesign}
            className="flex items-center justify-center gap-1.5 py-2 bg-[var(--theme-bg-subpanel)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--theme-text-primary)] rounded-lg text-[11px] font-semibold border border-[var(--theme-border)] transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-500" />
            <span>Motion Graphics</span>
          </button>
        )}

        {/* Kinetic Typography Config Toggle */}
        <button
          onClick={() => setShowKineticConfig(!showKineticConfig)}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold border transition-all shadow-sm ${
            showKineticConfig
              ? 'bg-teal-500/20 border-teal-500 text-teal-600 dark:text-teal-300 font-bold'
              : 'bg-[var(--theme-bg-subpanel)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--theme-text-primary)] border-[var(--theme-border)]'
          }`}
        >
          <Type className="w-3.5 h-3.5 text-amber-500" />
          <span>Kinetic Typography</span>
          {showKineticConfig ? <ChevronUp className="w-3.5 h-3.5 ml-0.5 text-teal-500" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5 text-[var(--theme-text-muted)]" />}
        </button>
      </div>

      {/* Kinetic Typography Configuration Panel */}
      {showKineticConfig && (
        <div className="mt-2 pt-3 border-t border-[var(--theme-border)] space-y-3 bg-[var(--theme-bg-subpanel)] rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--theme-text-primary)] flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-amber-500" /> Typography Generator
            </span>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-300 font-mono font-bold uppercase border border-teal-500/30">
              {typoMode} Mode
            </span>
          </div>

          {/* Mode Selector (Word, Sentence, Hybrid) */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-[var(--theme-text-primary)] uppercase tracking-wider">
              Animation Mode
            </label>
            <select
              value={typoMode}
              onChange={(e) => setTypoMode(e.target.value as 'word' | 'sentence' | 'hybrid')}
              disabled={isGeneratingKinetic}
              className="bg-[var(--theme-bg-card)] text-[var(--theme-text-primary)] text-[11px] font-semibold border border-[var(--theme-border)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 w-full shadow-sm"
            >
              <option value="hybrid">✨ Hybrid Mode (Full Sentence PiP, Words Animate In)</option>
              <option value="word">🔤 Word by Word (Separate Timed Clip Per Word)</option>
              <option value="sentence">📝 Sentence by Sentence (Complete Phrase Clips)</option>
            </select>
          </div>

          {/* Typography Layout Selector (Row vs Column) */}
          {(typoMode === 'hybrid' || typoMode === 'sentence') && (
            <div className="space-y-1 pt-1 border-t border-[var(--theme-border)] mt-2">
              <label className="block text-[10px] font-bold text-[var(--theme-text-primary)] uppercase tracking-wider">
                Typography Layout
              </label>
              <select
                value={typoLayout}
                onChange={(e) => setTypoLayout(e.target.value as 'row' | 'column')}
                disabled={isGeneratingKinetic}
                className="bg-[var(--theme-bg-card)] text-[var(--theme-text-primary)] text-[11px] font-semibold border border-[var(--theme-border)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 w-full shadow-sm"
              >
                <option value="row">Row Wise (16:9 Landscape Video)</option>
                <option value="column">Column Wise (9:16 Short Video / Reel)</option>
              </select>
            </div>
          )}

          {/* Language & Casing Settings */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[10px] text-[var(--theme-text-muted)] font-bold mb-1">Language / Script</label>
              <select
                value={script}
                onChange={(e) => setScript(e.target.value)}
                disabled={isGeneratingKinetic}
                className="bg-[var(--theme-bg-card)] text-[var(--theme-text-primary)] text-[10px] border border-[var(--theme-border)] rounded-lg p-2 w-full focus:outline-none focus:border-blue-500 shadow-sm"
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
              <label className="block text-[10px] text-[var(--theme-text-muted)] font-bold mb-1">Text Casing</label>
              <select
                value={casing}
                onChange={(e) => setCasing(e.target.value as 'all_caps' | 'first_letter_caps' | 'none')}
                disabled={isGeneratingKinetic}
                className="bg-[var(--theme-bg-card)] text-[var(--theme-text-primary)] text-[10px] border border-[var(--theme-border)] rounded-lg p-2 w-full focus:outline-none focus:border-blue-500 shadow-sm"
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
              <label className="block text-[10px] text-[var(--theme-text-muted)] font-bold mb-1">Visual Style</label>
              <select
                value={stylePreset}
                onChange={(e) => setStylePreset(e.target.value)}
                disabled={isGeneratingKinetic}
                className="bg-[var(--theme-bg-card)] text-[var(--theme-text-primary)] text-[10px] border border-[var(--theme-border)] rounded-lg p-2 w-full focus:outline-none focus:border-blue-500 shadow-sm"
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
              <label className="block text-[10px] text-[var(--theme-text-muted)] font-bold mb-1">Animation In</label>
              <select
                value={animationPreset}
                onChange={(e) => setAnimationPreset(e.target.value)}
                disabled={isGeneratingKinetic}
                className="bg-[var(--theme-bg-card)] text-[var(--theme-text-primary)] text-[10px] border border-[var(--theme-border)] rounded-lg p-2 w-full focus:outline-none focus:border-blue-500 shadow-sm"
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
              <div className="space-y-2 bg-[var(--theme-bg-card)] p-3 rounded-xl border border-blue-500/30 shadow-sm">
                <div className="flex items-center justify-between text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating {typoMode} typography...
                  </span>
                  <span className="font-mono text-xs font-bold">{kineticProgress}%</span>
                </div>
                <div className="w-full bg-[var(--theme-bg-subpanel)] h-1.5 rounded-full overflow-hidden border border-[var(--theme-border)]">
                  <div
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all duration-200"
                    style={{ width: `${kineticProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <button
                onClick={handleGenerateKinetic}
                className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Generate {typoMode === 'hybrid' ? 'Hybrid' : typoMode === 'word' ? 'Word' : 'Sentence'} Typography</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}