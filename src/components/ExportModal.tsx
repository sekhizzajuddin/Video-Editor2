import { X, Download, Film, Sparkles } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';
import { useState, useEffect, useRef } from 'react';
import { formatSimpleTime } from '@/utils/time';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { getFFmpegSeparationArgs } from '@/utils/audioSeparation';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();

export function ExportModal() {
  const { 
    showExportModal, setShowExportModal, totalDuration, tracks,
    previewCanvas, masterAudioStream, seek, isPlaying, togglePlayback, currentTime,
    inPoint, outPoint
  } = useEditorStore();
  const [fps, setFps] = useState('30');
  const [quality, setQuality] = useState('high');
  const [exportFormat, setExportFormat] = useState<'mp4' | 'webm'>('mp4');
  const [isExporting, setIsExporting] = useState(false);
  const [isRecordingStarted, setIsRecordingStarted] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Watch currentTime to update progress and stop recording
  useEffect(() => {
    if (isExporting && isRecordingStarted) {
      const startAt = inPoint !== null ? inPoint : 0;
      const endAt = outPoint !== null ? outPoint : totalDuration;
      const duration = Math.max(0.1, endAt - startAt);
      const elapsed = Math.max(0, currentTime - startAt);
      const p = Math.min(100, (elapsed / duration) * 100);
      setProgress(p);

      if (currentTime >= endAt) {
        if (recorderRef.current && recorderRef.current.state === 'recording') {
          recorderRef.current.stop();
        }
        if (isPlaying) {
          togglePlayback(); // pause
        }
        setIsExporting(false);
        setIsRecordingStarted(false);
      }
    }
  }, [currentTime, totalDuration, isExporting, isRecordingStarted, isPlaying, togglePlayback, inPoint, outPoint]);

  if (!showExportModal) return null;

  const handleExport = () => {
    if (!previewCanvas || !masterAudioStream) {
      alert("Canvas or Audio stream not initialized yet.");
      return;
    }

    setIsExporting(true);
    setIsRecordingStarted(false);
    setProgress(0);
    chunksRef.current = [];

    // Create combined stream
    const videoStream = previewCanvas.captureStream(parseInt(fps));
    const combinedStream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...masterAudioStream.getAudioTracks()
    ]);

    let mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8,opus';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }

    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: quality === 'max' ? 8000000 : quality === 'high' ? 5000000 : 2500000,
    });

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = async () => {
      const webmBlob = new Blob(chunksRef.current, { type: mimeType });
      
      if (exportFormat === 'webm') {
        const url = URL.createObjectURL(webmBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `procut-export-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
        setShowExportModal(false);
        setProgress(0);
        return;
      }

      // Convert to MP4 using FFmpeg WASM
      setIsConverting(true);
      setConversionProgress(0);
      
      try {
        // 1. Load FFmpeg
        if (!ffmpeg.loaded) {
          const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
          await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          });
        }

        // 2. Setup progress callback
        ffmpeg.on('progress', ({ progress: p }) => {
          setConversionProgress(Math.round(p * 100));
        });

        // 3. Write input WebM to virtual file system
        const inputData = await fetchFile(webmBlob);
        await ffmpeg.writeFile('input.webm', inputData);

        // 4. Build FFmpeg arguments
        // Collect audio separation settings from clips that have them enabled
        const separationArgs: string[] = [];
        for (const track of tracks) {
          for (const clip of track.clips) {
            if (clip.audioSettings?.vocalSeparation?.enabled) {
              const sepArgs = getFFmpegSeparationArgs(clip.audioSettings.vocalSeparation);
              separationArgs.push(...sepArgs);
            }
          }
        }

        // Run transcode
        // Using ultrafast preset and standard x264/aac parameters for rapid client-side conversion
        const ffmpegArgs = [
          '-i', 'input.webm',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-pix_fmt', 'yuv420p',
          ...separationArgs,
          '-c:a', 'aac',
          '-b:a', '128k',
          'output.mp4'
        ];
        await ffmpeg.exec(ffmpegArgs);

        // 5. Read output MP4 file
        const outputData = await ffmpeg.readFile('output.mp4');
        const mp4Blob = new Blob([outputData as any], { type: 'video/mp4' });
        
        // 6. Trigger download
        const url = URL.createObjectURL(mp4Blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `procut-export-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);

        // Clean up files in virtual FS
        await ffmpeg.deleteFile('input.webm');
        await ffmpeg.deleteFile('output.mp4');
      } catch (err) {
        console.error('FFmpeg WASM MP4 export failed, downloading WebM fallback:', err);
        alert('FFmpeg MP4 conversion failed (CORS or SharedArrayBuffer headers required). Downloading direct WebM instead.');
        
        // Fallback to WebM
        const url = URL.createObjectURL(webmBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `procut-export-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
      } finally {
        setIsConverting(false);
        setShowExportModal(false);
        setProgress(0);
      }
    };

    recorderRef.current = recorder;
    
    // Seek to In point (or 0) and start playback to trigger recording frames
    const startAt = inPoint !== null ? inPoint : 0;
    seek(startAt);
    setTimeout(() => {
      try {
        recorder.start();
        setIsRecordingStarted(true);
        if (!useEditorStore.getState().isPlaying) {
          togglePlayback();
        }
      } catch (err) {
        console.error("Failed to start MediaRecorder:", err);
        setIsExporting(false);
        setIsRecordingStarted(false);
        alert("Failed to start recording. Please try again.");
      }
    }, 250);
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
            disabled={isExporting || isConverting}
            className="p-1 text-[#a0a0a0] hover:text-white rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
                <span className="text-[#a0a0a0]">Render Resolution: </span>
                <span className="text-white">854 x 480 (16:9)</span>
              </div>
            </div>
          </div>

          {/* Export Format Selector */}
          <div>
            <label className="text-xs text-[#a0a0a0] block mb-2">Export Format</label>
            <div className="flex gap-2">
              {[
                { id: 'mp4', label: 'MP4 (H.264 + AAC)', desc: 'Max Compatibility' },
                { id: 'webm', label: 'WebM (VP9 + Opus)', desc: 'Direct / Raw' },
              ].map((fmt) => (
                <button
                  key={fmt.id}
                  disabled={isExporting || isConverting}
                  onClick={() => setExportFormat(fmt.id as any)}
                  className={`flex-1 px-3 py-2 rounded text-xs border transition-colors text-left ${
                    exportFormat === fmt.id
                      ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                      : 'bg-[#252525] border-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:border-[#a0a0a0] disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  <div className="font-semibold">{fmt.label}</div>
                  <div className="text-[9px] opacity-60 mt-0.5">{fmt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Frame Rate */}
          <div>
            <label className="text-xs text-[#a0a0a0] block mb-2">Frame Rate</label>
            <div className="flex gap-2">
              {['24', '30', '60'].map((f) => (
                <button
                  key={f}
                  disabled={isExporting || isConverting}
                  onClick={() => setFps(f)}
                  className={`px-4 py-2 rounded text-xs border transition-colors ${
                    fps === f
                      ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                      : 'bg-[#252525] border-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:border-[#a0a0a0] disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  {f} fps
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div>
            <label className="text-xs text-[#a0a0a0] block mb-2">Quality Preset</label>
            <div className="flex gap-2">
              {[
                { id: 'draft', label: 'Draft', desc: 'Fast render' },
                { id: 'high', label: 'High', desc: 'Balanced quality' },
                { id: 'max', label: 'Maximum', desc: 'Slow / High bitrate' },
              ].map((q) => (
                <button
                  key={q.id}
                  disabled={isExporting || isConverting}
                  onClick={() => setQuality(q.id)}
                  className={`flex-1 px-3 py-2 rounded text-xs border transition-colors text-left ${
                    quality === q.id
                      ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                      : 'bg-[#252525] border-[#3e3e3e] text-[#a0a0a0] hover:text-white hover:border-[#a0a0a0] disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  <div className="font-semibold">{q.label}</div>
                  <div className="text-[9px] opacity-60 mt-0.5">{q.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Recording Progress */}
          {isExporting && (
            <div className="bg-[#252525] rounded p-3 border border-[#3e3e3e]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white">Rendering Timeline...</span>
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

          {/* FFmpeg Conversion Progress */}
          {isConverting && (
            <div className="bg-[#252525] rounded p-3 border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  <span className="text-xs text-white font-medium">Assembling H.264 MP4 Container...</span>
                </div>
                <span className="text-xs text-amber-400">{conversionProgress}%</span>
              </div>
              <div className="h-2 bg-[#3e3e3e] rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-200"
                  style={{ width: `${conversionProgress}%` }}
                />
              </div>
              <p className="text-[9px] text-[#a0a0a0] leading-relaxed">
                FFmpeg WASM is encoding raw frames. Please keep this tab active to allow hardware acceleration.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-[#3e3e3e]">
          <button
            onClick={() => setShowExportModal(false)}
            disabled={isExporting || isConverting}
            className="px-4 py-2 text-xs text-[#a0a0a0] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || isConverting}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-[#3e3e3e] disabled:cursor-not-allowed text-white text-xs rounded flex items-center gap-1.5 transition-colors font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            {isExporting ? 'Rendering...' : isConverting ? 'Encoding MP4...' : 'Start Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
