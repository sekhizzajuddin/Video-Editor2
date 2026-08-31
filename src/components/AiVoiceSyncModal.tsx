import React, { useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { X, Mic, Loader2, Play } from 'lucide-react';
import { syncAiVoiceToSubtitles } from '@/utils/aiVoiceSync';
import { toast } from 'sonner';

export const CAPTION_LANGUAGES = [
  { code: 'EN', name: 'English' },
  { code: 'HI', name: 'Hindi' },
  { code: 'ES', name: 'Spanish' },
  { code: 'FR', name: 'French' },
  { code: 'DE', name: 'German' },
  { code: 'IT', name: 'Italian' },
  { code: 'PT', name: 'Portuguese' },
  { code: 'JA', name: 'Japanese' }
];

export const AiVoiceSyncModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const tracks = useEditorStore(state => state.tracks);
  const audioTracks = tracks.filter(t => t.type === 'audio' && t.clips.length > 0);
  
  const [selectedTrackId, setSelectedTrackId] = useState<string>(audioTracks[0]?.id || '');
  const [selectedLang, setSelectedLang] = useState<string>('EN');
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleSync = async () => {
    if (!selectedTrackId) return;
    setIsSyncing(true);
    setProgress(0);
    try {
      await syncAiVoiceToSubtitles(selectedTrackId, selectedLang, (p) => setProgress(Math.floor(p)));
      toast.success("Voice successfully synchronized to subtitles!");
      onClose();
    } catch (err: any) {
      console.error("AI Sync Error:", err);
      toast.error(err.message || "Failed to sync AI Voice.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-[var(--theme-bg-panel)] border border-[var(--theme-border)] rounded-2xl shadow-2xl p-5 w-full max-w-[420px] text-[var(--theme-text-primary)] animate-in fade-in zoom-in-95 duration-150 relative">
        
        <button 
          onClick={onClose}
          disabled={isSyncing}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4 text-[var(--theme-text-muted)]" />
        </button>

        <div className="flex items-center gap-2 mb-4 text-blue-500">
          <Mic className="w-5 h-5" />
          <h2 className="text-sm font-bold text-[var(--theme-text-primary)]">AI Voice Sync</h2>
        </div>

        <p className="text-[11px] text-[var(--theme-text-muted)] mb-5 leading-relaxed">
          Automatically splits and perfectly aligns an AI-generated voice track to match the pacing of your original subtitles.
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-[var(--theme-text-secondary)]">
              Audio Track (Voiceover)
            </label>
            <select
              value={selectedTrackId}
              onChange={(e) => setSelectedTrackId(e.target.value)}
              disabled={isSyncing}
              className="w-full bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            >
              <option value="" disabled>Select an audio track...</option>
              {audioTracks.map(t => (
                <option key={t.id} value={t.id}>{t.name || `Audio Track (ID: ${t.id.slice(0,4)})`}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-[var(--theme-text-secondary)]">
              Voice Language
            </label>
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              disabled={isSyncing}
              className="w-full bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)] rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
            >
              {CAPTION_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={isSyncing || !selectedTrackId}
          className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSyncing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Syncing... {progress}%
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              Start Sync
            </>
          )}
        </button>

      </div>
    </div>
  );
};
