import React, { useState } from 'react';
import { Type, Sparkles, Loader2, Play, Settings2 } from 'lucide-react';
import type { TimelineClip } from '@/types';
import { generateKineticTypography } from '@/utils/kineticTypography';
import { toast } from 'sonner';

interface KineticTypographySectionProps {
  selectedClip: TimelineClip;
  aiProvider?: 'gemini' | 'groq';
}

export function KineticTypographySection({
  selectedClip,
  aiProvider = 'gemini',
}: KineticTypographySectionProps) {
  const [provider, setProvider] = useState<'gemini' | 'groq'>(aiProvider);
  const [typoMode, setTypoMode] = useState<'word' | 'sentence' | 'hybrid'>('hybrid');
  const [typoLayout, setTypoLayout] = useState<'row' | 'column'>('row');
  const [script, setScript] = useState('english');
  const [casing, setCasing] = useState<'all_caps' | 'first_letter_caps' | 'none'>('none');
  const [stylePreset, setStylePreset] = useState<string>('minimal');
  const [animationPreset, setAnimationPreset] = useState<string>('pop');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showConfig, setShowConfig] = useState(false);

  const handleGenerate = async () => {
    if (!selectedClip) {
      toast.warning('Please select a video or audio clip on the timeline first.');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      await generateKineticTypography(
        selectedClip,
        selectedClip.trackId || '',
        {
          script,
          casing,
          styleSelection: stylePreset,
          animationSelection: animationPreset,
          provider,
          typoType: typoMode,
          typoLayout,
        },
        (p) => setProgress(Math.round(p))
      );
      toast.success(`Kinetic Typography (${typoMode.toUpperCase()}) created and synced!`);
      setShowConfig(false);
    } catch (err: any) {
      console.error('[Kinetic Typography] Generation failed:', err);
      toast.error(err?.message || 'Failed to generate kinetic typography.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-[#152323] border border-teal-500/30 rounded p-3 space-y-2.5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-teal-500/20 text-teal-400">
            <Type className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white">AI Kinetic Typography</h4>
            <p className="text-[9px] text-[#90b8b8]">Auto-transcribes & syncs animated word overlays</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowConfig(!showConfig)}
          className="p-1 text-teal-400 hover:text-teal-200 transition-colors"
          title="Toggle Typography Settings"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-[10px] text-zinc-300 leading-relaxed">
        Extract spoken words from this clip and generate broadcast-ready kinetic typography synced precisely to speech cadence.
      </p>

      {showConfig && (
        <div className="space-y-2 pt-2 border-t border-teal-500/20 text-[10px]">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-zinc-400 block mb-0.5">Style</label>
              <select
                value={stylePreset}
                onChange={(e) => setStylePreset(e.target.value)}
                className="w-full bg-[#1a2c2c] text-white border border-teal-500/30 rounded px-1.5 py-1 focus:outline-none focus:border-teal-400"
              >
                <option value="minimal">Minimal Clean</option>
                <option value="pop">Pop-in Highlight</option>
                <option value="bounce">Bouncy Comic</option>
                <option value="neon">Cyber Neon</option>
                <option value="karaoke">Karaoke Fill</option>
              </select>
            </div>
            <div>
              <label className="text-zinc-400 block mb-0.5">Layout</label>
              <select
                value={typoLayout}
                onChange={(e) => setTypoLayout(e.target.value as any)}
                className="w-full bg-[#1a2c2c] text-white border border-teal-500/30 rounded px-1.5 py-1 focus:outline-none focus:border-teal-400"
              >
                <option value="row">Single Line (Row)</option>
                <option value="column">Stacked (Column)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-zinc-400 block mb-0.5">Casing</label>
              <select
                value={casing}
                onChange={(e) => setCasing(e.target.value as any)}
                className="w-full bg-[#1a2c2c] text-white border border-teal-500/30 rounded px-1.5 py-1 focus:outline-none focus:border-teal-400"
              >
                <option value="none">Normal Case</option>
                <option value="all_caps">ALL CAPS</option>
                <option value="first_letter_caps">First Letter</option>
              </select>
            </div>
            <div>
              <label className="text-zinc-400 block mb-0.5">AI Engine</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as any)}
                className="w-full bg-[#1a2c2c] text-white border border-teal-500/30 rounded px-1.5 py-1 focus:outline-none focus:border-teal-400"
              >
                <option value="gemini">Gemini 2.0</option>
                <option value="groq">Groq Whisper</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={isGenerating}
        className="w-full py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Generating Kinetic Words ({progress}%)...
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5 text-teal-200" />
            Generate Kinetic Typography
          </>
        )}
      </button>
    </div>
  );
}
