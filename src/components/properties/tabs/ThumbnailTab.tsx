import { ImageIcon, Sparkles } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { toast } from 'sonner';

interface ThumbnailTabProps {
  selectedClip?: any;
}

export function ThumbnailTab({ selectedClip }: ThumbnailTabProps) {
  return (
    <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
      <div className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] p-4 flex flex-col gap-3 shadow-sm">
        <h3 className="text-xs font-bold text-[var(--theme-text-primary)] flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-blue-500" />
          Thumbnail Designer
        </h3>
        <p className="text-[10px] text-[var(--theme-text-muted)] leading-relaxed">
          Add text, stickers, and shapes to the timeline to design your thumbnail. Click the button below to capture the current frame as an image.
        </p>
        
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-[var(--theme-text-primary)] font-semibold flex-1 cursor-pointer select-none">
            Show YouTube Safe Zones
          </label>
          <button
            onClick={() => {
              const current = useEditorStore.getState().settings.showSafeZones;
              useEditorStore.getState().updateSettings({ showSafeZones: !current });
            }}
            className={`w-8 h-4 rounded-full transition-colors relative ${
              useEditorStore.getState().settings.showSafeZones ? 'bg-blue-600' : 'bg-[var(--theme-bg-subpanel)] border border-[var(--theme-border)]'
            }`}
          >
            <div className={`w-3 h-3 rounded-full bg-white absolute top-[1px] transition-all shadow-sm ${
              useEditorStore.getState().settings.showSafeZones ? 'left-[17px]' : 'left-[1px]'
            }`} />
          </button>
        </div>

        <button
          onClick={() => {
            const canvas = document.querySelector('#preview-canvas, .preview-canvas') as HTMLCanvasElement;
            if (!canvas) {
              toast.warning("Preview canvas not found!");
              return;
            }
            const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
            const link = document.createElement('a');
            link.download = 'thumbnail.jpg';
            link.href = dataUrl;
            link.click();
          }}
          className="mt-2 w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Capture High-Res Thumbnail
        </button>
      </div>

      <div className="bg-[var(--theme-bg-card)] rounded-xl border border-[var(--theme-border)] p-4 shadow-sm">
        <h4 className="text-[11px] font-bold text-[var(--theme-text-primary)] mb-2">Quick Actions</h4>
        <div className="space-y-2">
          <button
            onClick={() => {
              useEditorStore.getState().updateSettings({ showSafeZones: true });
            }}
            className="w-full py-2 bg-[var(--theme-bg-subpanel)] hover:bg-black/5 dark:hover:bg-white/5 border border-[var(--theme-border)] rounded-lg text-[10px] font-semibold text-[var(--theme-text-primary)] transition-colors shadow-sm"
          >
            Show Safe Zones
          </button>
          <button
            onClick={() => {
              useEditorStore.getState().updateSettings({ showSafeZones: false });
            }}
            className="w-full py-2 bg-[var(--theme-bg-subpanel)] hover:bg-black/5 dark:hover:bg-white/5 border border-[var(--theme-border)] rounded-lg text-[10px] font-semibold text-[var(--theme-text-primary)] transition-colors shadow-sm"
          >
            Hide Safe Zones
          </button>
        </div>
      </div>
    </div>
  );
}