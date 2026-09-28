import React from 'react';
import { X, Cpu, Download, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';
import { setUserSkippedDesktopPrompt } from '@/utils/desktopAiBridge';

interface DesktopAiCutoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUseBrowser: () => void;
  onOpenDesktop?: () => void;
}

export const DesktopAiCutoutModal: React.FC<DesktopAiCutoutModalProps> = ({
  isOpen,
  onClose,
  onUseBrowser,
  onOpenDesktop,
}) => {
  if (!isOpen) return null;

  const handleSkip = () => {
    setUserSkippedDesktopPrompt();
    onUseBrowser();
    onClose();
  };

  const handleDownload = () => {
    if (onOpenDesktop) {
      onOpenDesktop();
    } else {
      window.open('https://github.com/Augani/openreel-video/releases', '_blank');
    }
    // Also continue so user is not stuck
    onUseBrowser();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card-bg,#16171b)] p-6 shadow-2xl text-[var(--theme-text)]">
        {/* Close Button */}
        <button
          onClick={handleSkip}
          className="absolute right-4 top-4 rounded-lg p-1 text-[var(--theme-text-muted)] hover:bg-white/10 hover:text-[var(--theme-text)] transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Icon */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight">AI Cutout Engine</h3>
            <p className="text-xs text-[var(--theme-text-muted)]">Choose your processing acceleration</p>
          </div>
        </div>

        {/* Body content */}
        <div className="space-y-3 mb-6">
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3.5 flex items-start gap-3">
            <Zap className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-medium text-cyan-200 block">Desktop GPU Companion (Fastest)</span>
              <p className="text-[var(--theme-text-muted)]">
                Processes video frames with direct hardware acceleration and zero memory limitations.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-medium text-emerald-300 block">In-Browser AI (Instant)</span>
              <p className="text-[var(--theme-text-muted)]">
                Runs directly in your browser with per-frame neural matting. No install required.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={handleSkip}
            className="w-full py-2.5 px-4 rounded-xl font-medium text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <span>Continue with In-Browser AI</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            onClick={handleDownload}
            className="w-full py-2.5 px-4 rounded-xl font-medium text-sm border border-[var(--theme-border)] hover:bg-white/5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text)] flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Install / Launch Desktop App</span>
          </button>
        </div>
      </div>
    </div>
  );
};
