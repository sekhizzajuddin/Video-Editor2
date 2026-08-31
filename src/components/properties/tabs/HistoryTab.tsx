import { Move3D } from 'lucide-react';

interface HistoryTabProps {
  history: any[];
  historyIndex: number;
  jumpToHistoryIndex: (idx: number) => void;
}

export function HistoryTab({ history, historyIndex, jumpToHistoryIndex }: HistoryTabProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="p-3 border-b border-[var(--theme-border)] flex items-center justify-between shrink-0 bg-[var(--theme-bg-subpanel)] shadow-sm">
        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Undo/Redo History</span>
        <span className="text-[9px] text-[var(--theme-text-muted)] bg-[var(--theme-bg-card)] border border-[var(--theme-border)] rounded-md px-2 py-0.5 font-mono font-medium">
          {history.length} Actions
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
        {history.map((snap, idx) => {
          const isActive = idx === historyIndex;
          const isFuture = idx > historyIndex;
          return (
            <button
              key={idx}
              onClick={() => jumpToHistoryIndex(idx)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all border shadow-sm ${
                isActive
                  ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 font-bold'
                  : isFuture
                  ? 'bg-[var(--theme-bg-subpanel)]/40 border-transparent text-[var(--theme-text-muted)]/40 hover:text-[var(--theme-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                  : 'bg-[var(--theme-bg-card)] border-[var(--theme-border)] text-[var(--theme-text-primary)] hover:border-blue-500/40 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              {/* Visual Line Node */}
              <div className="relative flex items-center justify-center shrink-0 w-4">
                {idx < history.length - 1 && (
                  <div className={`absolute top-4 bottom-[-24px] w-[2px] ${
                    isFuture ? 'bg-[var(--theme-border)]/40' : 'bg-blue-500/30'
                  }`} />
                )}
                <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                  isActive
                    ? 'bg-blue-500 border-blue-500 ring-4 ring-blue-500/20 scale-110'
                    : isFuture
                    ? 'bg-transparent border-[var(--theme-border)]'
                    : 'bg-blue-500/40 border-blue-500/80'
                }`} />
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-xs truncate block font-medium">{snap.label || 'Action'}</span>
                <span className="text-[9px] opacity-60 block mt-0.5 font-mono">
                  {idx === 0 ? 'Base State' : `Step ${idx}`}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}