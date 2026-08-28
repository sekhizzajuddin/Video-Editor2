import React from 'react';
import { Check, Loader2 } from 'lucide-react';

export interface GenerationProgressProps {
  step: string;
  progress: number;
  message?: string;
}

interface StepItem {
  id: string;
  label: string;
}

const STEPS: StepItem[] = [
  { id: 'extracting', label: 'Extracting' },
  { id: 'transcribing', label: 'Transcribing' },
  { id: 'designing', label: 'AI Designing' },
  { id: 'rendering', label: 'Rendering' },
  { id: 'encoding', label: 'Encoding' },
];

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  step,
  progress,
  message,
}) => {
  const currentStepIndex = STEPS.findIndex((s) => s.id === step);
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="bg-[#1a1a1a] border border-[#3e3e3e] rounded-xl p-3.5 space-y-2.5 shadow-lg">
      {/* Steps Row */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, idx) => {
          const isDone = step === 'done' || (currentStepIndex !== -1 && idx < currentStepIndex);
          const isCurrent = step === s.id;

          let statusClass = 'text-[#606060]';
          if (isCurrent) {
            statusClass = 'text-amber-400 font-semibold';
          } else if (isDone) {
            statusClass = 'text-emerald-400 font-medium';
          }

          return (
            <div key={s.id} className="flex items-center gap-1.5 flex-1 min-w-[70px]">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 transition-colors ${
                  isDone
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : isCurrent
                    ? 'bg-amber-400 text-black font-bold ring-2 ring-amber-400/30 animate-pulse'
                    : 'bg-[#252525] text-[#707070] border border-[#3e3e3e]'
                }`}
              >
                {isDone ? (
                  <Check className="w-3 h-3 stroke-[2.5]" />
                ) : isCurrent ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  idx + 1
                )}
              </div>

              <span className={`text-[11px] truncate ${statusClass}`}>
                {s.label}
              </span>

              {idx < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 min-w-[8px] mx-1 transition-colors ${
                    isDone ? 'bg-emerald-500/40' : 'bg-[#2d2d2d]'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="w-full h-2 bg-[#252525] rounded-full overflow-hidden border border-[#3e3e3e]/40 relative">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300 ease-out rounded-full"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs px-0.5">
          <span className="text-[#a0a0a0] truncate max-w-[75%] font-mono text-[11px]">
            {message || 'Processing generative motion...'}
          </span>
          <span className="font-semibold text-amber-400 font-mono text-[11px]">
            {clampedProgress}%
          </span>
        </div>
      </div>
    </div>
  );
};
