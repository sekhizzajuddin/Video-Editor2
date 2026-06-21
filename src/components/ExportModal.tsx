import { X, Download } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useState } from 'react';
import { formatSimpleTime } from '@/utils/time';

export function ExportModal() {
  const { showExportModal, setShowExportModal, totalDuration, tracks } = useEditorStore();
  const [format, setFormat] = useState('mp4');
  const [resolution, setResolution] = useState('1080p');
  const [fps, setFps] = useState('30');
  const [quality, setQuality] = useState('high');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  if (!showExportModal) return null;

  const handleExport = () => {
    setIsExporting(true);
    setProgress(0);
    // Simulate export progress
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsExporting(false);
            setShowExportModal(false);
            setProgress(0);
          }, 500);
          return 100;
        }
        return p + Math.random() * 8 + 2;
      });
    }, 200);
  };

  const totalClips = tracks.reduce((acc, t) => acc + t.clips.length, 0);

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center">
      <div className="bg-[#2d2d2d] rounded-lg shadow-2xl w-[480px] max-h-[90vh] overflow-y-auto border border-[#3e3e3e]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#3e3e3e]">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Export Video</h2>
          </div>
          <button
            onClick={() => setShowExportModal(false)}
            className="p-1 text-[#a0a0a0] hover:text-white rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Project Info */}
          <div className="bg-[#252525] rounded p-3 border border-[#3e3e3e]">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[#a0a0a0]">Duration: </span>
                <span className="text-white">{formatSimpleTime(totalDuration)}</span>
              </div>
              <div>
                <span className="text-[#a0a0a0]">Clips: </span>
                <span className="text-white">{totalClips}</span>
              </div>
              <div>
                <span className="text-[#a0a0a0]">Tracks: </span>
                <span className="text-white">{tracks.length}</span>
              </div>
              <div>
                <span className="text-[#a0a0a0]">Format: </span>
                <span className="text-white">{format.toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="text-xs text-[#a0a0a0] block mb-2">Format</label>
            <div className="grid grid-cols-3 gap-2">
              {['mp4', 'mov', 'webm', 'avi', 'mkv', 'gif'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`px-3 py-2 rounded text-xs border transition-colors ${
                    format === f
                      ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                      : 'bg-[#252525] border-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:border-[#a0a0a0]'
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div>
            <label className="text-xs text-[#a0a0a0] block mb-2">Resolution</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: '720p', label: 'HD 720p', res: '1280 x 720' },
                { id: '1080p', label: 'Full HD', res: '1920 x 1080' },
                { id: '4k', label: '4K UHD', res: '3840 x 2160' },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setResolution(r.id)}
                  className={`px-3 py-2 rounded text-xs border transition-colors ${
                    resolution === r.id
                      ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                      : 'bg-[#252525] border-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:border-[#a0a0a0]'
                  }`}
                >
                  <div>{r.label}</div>
                  <div className="text-[9px] opacity-60 mt-0.5">{r.res}</div>
                </button>
              ))}
            </div>
          </div>

          {/* FPS */}
          <div>
            <label className="text-xs text-[#a0a0a0] block mb-2">Frame Rate</label>
            <div className="flex gap-2">
              {['24', '30', '60'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFps(f)}
                  className={`px-4 py-2 rounded text-xs border transition-colors ${
                    fps === f
                      ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                      : 'bg-[#252525] border-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:border-[#a0a0a0]'
                  }`}
                >
                  {f} fps
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div>
            <label className="text-xs text-[#a0a0a0] block mb-2">Quality</label>
            <div className="flex gap-2">
              {[
                { id: 'draft', label: 'Draft', desc: 'Fast' },
                { id: 'high', label: 'High', desc: 'Balanced' },
                { id: 'max', label: 'Maximum', desc: 'Slow' },
              ].map((q) => (
                <button
                  key={q.id}
                  onClick={() => setQuality(q.id)}
                  className={`flex-1 px-3 py-2 rounded text-xs border transition-colors ${
                    quality === q.id
                      ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                      : 'bg-[#252525] border-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:border-[#a0a0a0]'
                  }`}
                >
                  <div>{q.label}</div>
                  <div className="text-[9px] opacity-60">{q.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Progress */}
          {isExporting && (
            <div className="bg-[#252525] rounded p-3 border border-[#3e3e3e]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white">Exporting...</span>
                <span className="text-xs text-amber-400">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-[#3e3e3e] rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#3e3e3e]">
          <button
            onClick={() => setShowExportModal(false)}
            className="px-4 py-2 text-xs text-[#a0a0a0] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-[#3e3e3e] text-white text-xs rounded flex items-center gap-1.5 transition-colors font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
