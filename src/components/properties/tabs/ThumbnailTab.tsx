import { ImageIcon, Sparkles } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { toast } from 'sonner';

interface ThumbnailTabProps {
  selectedClip?: any;
}

export function ThumbnailTab({ selectedClip }: ThumbnailTabProps) {
  return (
    <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
      <div className="bg-popover rounded border border-border p-3 flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-amber-500" />
          Thumbnail Designer
        </h3>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Add text, stickers, and shapes to the timeline to design your thumbnail. Click the button below to capture the current frame as an image.
        </p>
        
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-foreground flex-1 cursor-pointer select-none">
            Show YouTube Safe Zones
          </label>
          <button
            onClick={() => {
              const current = useEditorStore.getState().settings.showSafeZones;
              useEditorStore.getState().updateSettings({ showSafeZones: !current });
            }}
            className={`w-8 h-4 rounded-full transition-colors relative ${
              useEditorStore.getState().settings.showSafeZones ? 'bg-amber-500' : 'bg-card border border-border'
            }`}
          >
            <div className={`w-3 h-3 rounded-full bg-white absolute top-[1px] transition-all ${
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
          className="mt-2 w-full py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded text-xs font-semibold shadow-lg shadow-orange-900/20 transition-all flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Capture High-Res Thumbnail
        </button>
      </div>

      <div className="bg-popover rounded border border-border p-3">
        <h4 className="text-[11px] font-semibold text-foreground mb-2">Quick Actions</h4>
        <div className="space-y-2">
          <button
            onClick={() => {
              useEditorStore.getState().updateSettings({ showSafeZones: true });
            }}
            className="w-full py-1.5 bg-card hover:bg-accent border border-border rounded text-[10px] text-foreground transition-colors"
          >
            Show Safe Zones
          </button>
          <button
            onClick={() => {
              useEditorStore.getState().updateSettings({ showSafeZones: false });
            }}
            className="w-full py-1.5 bg-card hover:bg-accent border border-border rounded text-[10px] text-foreground transition-colors"
          >
            Hide Safe Zones
          </button>
        </div>
      </div>
    </div>
  );
}