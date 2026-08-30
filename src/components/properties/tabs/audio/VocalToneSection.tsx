import { Loader2, Sparkles } from 'lucide-react';
import { effectiveVocalFormant, effectiveVocalPitchSt, type VocalToneSettings } from '@/utils/vocalTone';

export interface VocalMatchRow {
  clipId: string;
  clipName: string;
  f0: number | null;
  shiftSemitones: number | null;
  status: 'reference' | 'matched' | 'no-audio' | 'no-voice' | 'error';
}

interface VocalToneSectionProps {
  clipAudio: VocalToneSettings;
  hasEnoughClips: boolean;
  isMatchingVocals: boolean;
  matchResults: VocalMatchRow[];
  matchError: string | null;
  onToneChange: (v: number) => void;
  onToneReset: () => void;
  onToggleAutoMatch: (enabled: boolean) => void;
  onAutoMatch: () => void;
}

function toneLabel(tone: number): string {
  if (tone === 0) return 'Original';
  if (tone < 0) return `Girl / Lady${tone === -100 ? '' : ` (${tone})`}`;
  return `Boy / Man${tone === 100 ? '' : ` (${tone})`}`;
}

export function VocalToneSection({
  clipAudio,
  hasEnoughClips,
  isMatchingVocals,
  matchResults,
  matchError,
  onToneChange,
  onToneReset,
  onToggleAutoMatch,
  onAutoMatch,
}: VocalToneSectionProps) {
  const tone = clipAudio.tone ?? 0;
  const autoMatchOn = !!clipAudio.vocalMatchEnabled;
  const autoShift = clipAudio.vocalMatchShift;
  const hasShift = typeof autoShift === 'number' && Number.isFinite(autoShift) && autoShift !== 0;
  const pitchSt = effectiveVocalPitchSt(clipAudio);
  const formant = effectiveVocalFormant(clipAudio);

  const statusColor: Record<VocalMatchRow['status'], string> = {
    reference: 'text-teal-400',
    matched: 'text-green-400',
    'no-audio': 'text-amber-400',
    'no-voice': 'text-amber-400',
    error: 'text-red-400',
  };

  return (
    <div className="space-y-2 border-t border-[#2a2a3a] pt-3">
      {/* Vocal Tone slider */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-[#d0d0d0]">Vocal Tone</span>
          <span className="font-mono text-[#a0a0a0]">
            {tone === 0 ? 'Original' : `${toneLabel(tone)} · ${tone > 0 ? '+' : ''}${(tone * 0.05).toFixed(1)} st`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={-100}
            max={100}
            step={1}
            value={tone}
            onChange={(e) => onToneChange(Number(e.target.value))}
            onDoubleClick={onToneReset}
            title="Double-click to reset to Original (0)"
            className="flex-1 h-1 bg-[#3e3e3e] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-pink-500 [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
        <div className="flex justify-between text-[9px] text-[#6a6a7a] font-mono">
          <span>-100 Girl / Lady</span>
          <span>0 Original</span>
          <span>+100 Boy / Man</span>
        </div>
        {(pitchSt !== 0 || formant !== 0) && (
          <div className="text-[9px] font-mono text-[#7a7a8a]">
            Effective: {pitchSt > 0 ? '+' : ''}{pitchSt} st · Formant {formant > 0 ? '+' : ''}{formant}
          </div>
        )}
      </div>

      {/* Auto vocal matching */}
      <div className="space-y-1.5">
        <button
          onClick={onAutoMatch}
          disabled={isMatchingVocals || !hasEnoughClips}
          title={
            hasEnoughClips
              ? 'Analyses the vocal frequency of the first clip, then adjusts every other clip so all voices match'
              : 'Add at least 2 clips with audio to the timeline'
          }
          className="w-full py-1.5 bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/30 text-teal-400 rounded text-[11px] font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {isMatchingVocals ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Analysing voices…
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3" />
              Auto-Match All Vocals to First Clip
            </>
          )}
        </button>
        {!hasEnoughClips && !isMatchingVocals && (
          <div className="text-[9px] text-[#6a6a7a]">Need at least 2 clips with audio.</div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-[#a0a0a0]">Auto-match this clip</span>
          <button
            onClick={() => onToggleAutoMatch(!autoMatchOn)}
            disabled={isMatchingVocals}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors disabled:opacity-50 ${
              autoMatchOn ? 'bg-teal-600/30 text-teal-300 border border-teal-500/40' : 'bg-[#2d2d2d] text-[#a0a0a0] border border-[#3a3a4a]'
            }`}
          >
            {autoMatchOn ? 'ON' : 'OFF'}
          </button>
        </div>

        {autoMatchOn && (
          <div className="text-[9px] font-mono text-[#7a7a8a]">
            {hasShift
              ? `Correction ${autoShift > 0 ? '+' : ''}${autoShift} st applied on top of your settings`
              : 'No match data yet — run Auto-Match first'}
          </div>
        )}

        {matchError && <div className="text-[10px] text-red-400">{matchError}</div>}

        {matchResults.length > 0 && (
          <div className="max-h-28 overflow-y-auto space-y-0.5 rounded bg-[#191925] border border-[#2a2a3a] p-1.5">
            {matchResults.map((r) => (
              <div key={r.clipId} className="flex justify-between items-center text-[9px] font-mono">
                <span className="text-[#a0a0a0] truncate max-w-[55%]">{r.clipName}</span>
                <span className={statusColor[r.status]}>
                  {r.status === 'reference'
                    ? 'Reference'
                    : r.status === 'matched'
                      ? `${r.f0?.toFixed(0) ?? '?'} Hz → ${r.shiftSemitones! > 0 ? '+' : ''}${r.shiftSemitones} st`
                      : r.status === 'no-voice'
                        ? 'No voice detected'
                        : r.status === 'no-audio'
                          ? 'No audio'
                          : 'Decode failed'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
