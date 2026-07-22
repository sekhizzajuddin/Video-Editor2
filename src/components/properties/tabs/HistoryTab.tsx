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
      <div className="p-3 border-b border-[#3e3e3e] flex items-center justify-between shrink-0 bg-[#1e1e1e]/30">
        <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Undo/Redo History</span>
        <span className="text-[9px] text-[#8a8a8a] bg-[#1e1e1e] border border-[#3e3e3e] rounded px-1.5 py-0.5 font-mono">
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
              className={`w-full flex items-center gap-3 p-2 rounded text-left transition-all border ${
                isActive
                  ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-medium shadow-md shadow-amber-500/5'
                  : isFuture
                  ? 'bg-[#1e1e1e]/40 border-transparent text-[#a0a0a0]/40 hover:text-white hover:bg-[#2d2d2d]'
                  : 'bg-[#1e1e1e]/60 border-transparent text-[#a0a0a0] hover:text-white hover:bg-[#2d2d2d]'
              }`}
            >
              {/* Visual Line Node */}
              <div className="relative flex items-center justify-center shrink-0 w-4">
                {idx < history.length - 1 && (
                  <div className={`absolute top-4 bottom-[-24px] w-[2px] ${
                    isFuture ? 'bg-[#3e3e3e]/40' : 'bg-amber-500/30'
                  }`} />
                )}
                <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                  isActive
                    ? 'bg-amber-400 border-amber-400 ring-4 ring-amber-500/20 scale-110'
                    : isFuture
                    ? 'bg-transparent border-[#3e3e3e]'
                    : 'bg-amber-500/40 border-amber-500/80'
                }`} />
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-xs truncate block">{snap.label || 'Action'}</span>
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