import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Code2,
  Send,
  Plus,
  Film,
  Layers,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import type { GenerativeResult } from '@/utils/generateMotionGraphicsFromDialogue';
import type { HtmlCssScene, MotionGraphicVideo } from '@/utils/motionGraphicRenderer';
import { CodeEditor } from './CodeEditor';

export interface ResultPreviewProps {
  result: GenerativeResult | null;
  /** Object URL for `result.video.blob`, owned by the workspace hook. */
  motionVideoUrl?: string | null;
  selectedClipUrl: string | null;
  selectedClipName?: string;
  selectedClipDuration?: number;
  isGenerating?: boolean;
  isRendering?: boolean;
  onRePrompt: (prompt: string) => void;
  onApply: () => void;
  showCodeEditor: boolean;
  setShowCodeEditor: (show: boolean | ((prev: boolean) => boolean)) => void;
  editedHtmlCss: string;
  setEditedHtmlCss: (val: string) => void;
  originalHtmlCss: string;
  isDirty?: boolean;
  onRenderFromCode?: () => void;
  onResetCode: () => void;
}

export type PreviewDisplayMode = 'composite' | 'motion-only' | 'video-only';
export type PreviewSource = 'rendered' | 'live';

/* ────────────────────────────────────────────────────────────────────────────
 * Live CSS scene overlay
 *
 * The rendered WebM is the source of truth for export, but scrubbing raw CSS is
 * far nicer while editing code. Inside a LIVE iframe document the Web Animations
 * API timeline is real, so `animation.currentTime = t` scrubs perfectly (unlike
 * the SVG-image capture path, which is why the renderer uses negative
 * animation-delay there — see utils/cssSceneRasterizer).
 * ────────────────────────────────────────────────────────────────────────── */

const SCENE_SEEK_SCRIPT = `(function(){
  function anims(){ try { return document.getAnimations ? document.getAnimations() : []; } catch(e){ return []; } }
  function seek(t){
    var list = anims();
    for (var i = 0; i < list.length; i++){
      try { var a = list[i]; a.pause(); try { a.currentTime = t; } catch(e){} } catch(e){}
    }
  }
  function play(t){
    var list = anims();
    for (var i = 0; i < list.length; i++){
      try { var a = list[i]; try { a.currentTime = t; } catch(e){} a.play(); } catch(e){}
    }
  }
  window.addEventListener('message', function(ev){
    var d = (ev && ev.data) || {};
    if (d.type === 'procut:seek') seek(d.t * 1000);
    else if (d.type === 'procut:play') play(d.t * 1000);
    else if (d.type === 'procut:pause') seek(d.t * 1000);
  });
  try { window.parent.postMessage({ type: 'procut:ready' }, '*'); } catch(e){}
})();`;

function buildSceneDoc(html: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  *{box-sizing:border-box;}
  html,body{margin:0;padding:0;width:1920px;height:1080px;background:transparent;overflow:hidden;}
</style>
</head>
<body>
${html}
<script>${SCENE_SEEK_SCRIPT}</script>
</body>
</html>`;
}

interface SceneOverlayProps {
  scene: HtmlCssScene;
  time: number;
  playing: boolean;
}

const SceneOverlay: React.FC<SceneOverlayProps> = ({ scene, time, playing }) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const localRef = useRef(0);
  const postedRef = useRef(-1);

  const active = time >= scene.enterAt && time <= scene.exitAt;
  const local = Math.max(0, time - scene.enterAt);
  localRef.current = local;

  useEffect(() => {
    if (!active) {
      setReady(false);
      postedRef.current = -1;
    }
  }, [active]);

  const post = useCallback((msg: { type: string; t: number }) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(msg, '*');
      postedRef.current = msg.t;
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev?.data?.type === 'procut:ready') {
        setReady(true);
        postedRef.current = -1;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Start / resume / pause when the transport state flips.
  useEffect(() => {
    if (!active || !ready) return;
    post({ type: playing ? 'procut:play' : 'procut:pause', t: localRef.current });
  }, [active, ready, playing, post]);

  // Scrub while paused, and re-sync after a loop or a big jump.
  useEffect(() => {
    if (!active || !ready) return;
    const drift = Math.abs(local - postedRef.current);
    if (!playing) {
      post({ type: 'procut:seek', t: local });
    } else if (drift > 0.4) {
      post({ type: 'procut:play', t: local });
    }
  }, [local, active, ready, playing, post]);

  // Built once per scene revision — the parent re-renders every animation frame.
  const doc = useMemo(() => buildSceneDoc(scene.htmlCss), [scene.htmlCss]);

  if (!active) return null;

  // The 1920x1080 stage is laid out at native size and scaled to fit: the parent
  // centers it with flex, so `transform-origin: center` keeps it aligned with the
  // base video layer (an absolutely positioned box would drift off-centre).
  return (
    <iframe
      ref={iframeRef}
      srcDoc={doc}
      title="Motion Scene Overlay"
      sandbox="allow-scripts"
      className="border-none pointer-events-none shrink-0 max-w-none"
      style={{
        width: '1920px',
        height: '1080px',
        transform: 'scale(var(--scene-scale, 1))',
        transformOrigin: 'center center',
        background: 'transparent',
      }}
    />
  );
};

/* ────────────────────────────────────────────────────────────────────────────
 * Preview Theater
 * ────────────────────────────────────────────────────────────────────────── */

export const ResultPreview: React.FC<ResultPreviewProps> = ({
  result,
  motionVideoUrl = null,
  selectedClipUrl,
  selectedClipName,
  selectedClipDuration = 0,
  isGenerating = false,
  isRendering = false,
  onRePrompt,
  onApply,
  showCodeEditor,
  setShowCodeEditor,
  editedHtmlCss,
  setEditedHtmlCss,
  originalHtmlCss,
  isDirty = false,
  onRenderFromCode,
  onResetCode,
}) => {
  const [displayMode, setDisplayMode] = useState<PreviewDisplayMode>('composite');
  const [previewSource, setPreviewSource] = useState<PreviewSource>('rendered');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isRePromptOpen, setIsRePromptOpen] = useState(false);
  const [rePromptText, setRePromptText] = useState('');
  const [sceneScale, setSceneScale] = useState(1);

  const baseVideoRef = useRef<HTMLVideoElement | null>(null);
  const motionVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const clockRef = useRef<{ wall: number; t: number } | null>(null);
  const currentTimeRef = useRef(0);

  currentTimeRef.current = currentTime;

  const video = result?.video ?? null;

  // Scenes to scrub in the live CSS layer. Hand-edited code (or the reference
  // demo scene) is previewable even before a result/video exists.
  const scenes: HtmlCssScene[] = useMemo(() => {
    const fromSpec = result?.spec?.htmlCssScenes ?? [];
    if (fromSpec.length > 0) return fromSpec;
    if (editedHtmlCss.trim().length === 0) return [];
    return [
      {
        enterAt: 0,
        exitAt: Math.max(0.5, selectedClipDuration || 15),
        description: 'Edited scene',
        htmlCss: editedHtmlCss,
      },
    ];
  }, [result, editedHtmlCss, selectedClipDuration]);

  const hasLiveScenes = scenes.length > 0;

  const effectiveDuration =
    result?.spec?.duration || selectedClipDuration || 15;


  // Derive transport state from a new result *during render* (the React
  // recommended alternative to a setState-in-effect cascade): a freshly rendered
  // video takes over the preview; otherwise fall back to the live CSS layer.
  const lastVideoRef = useRef<MotionGraphicVideo | null>(null);
  if (video !== lastVideoRef.current) {
    lastVideoRef.current = video;
    if (video && video.blob.size > 8) {
      setPreviewSource('rendered');
    } else if (hasLiveScenes) {
      setPreviewSource('live');
    }
    if (currentTime !== 0) setCurrentTime(0);
    if (isPlaying) setIsPlaying(false);
  }

  // Measure the theater so 1920x1080 overlays can be scaled to fit.
  useEffect(() => {
    const el = screenRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0) {
        setSceneScale(Math.min(1, rect.width / 1920));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const seekAll = useCallback((time: number) => {
    setCurrentTime(time);
    if (baseVideoRef.current) {
      try {
        baseVideoRef.current.currentTime = time;
      } catch {
        /* ignore */
      }
    }
    if (motionVideoRef.current) {
      try {
        motionVideoRef.current.currentTime = time;
      } catch {
        /* ignore */
      }
    }
    clockRef.current = { wall: performance.now(), t: time };
  }, []);

  const togglePlay = useCallback(() => {
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);

    if (nextPlaying) {
      const startAt = currentTimeRef.current >= effectiveDuration - 0.05 ? 0 : currentTimeRef.current;
      if (startAt === 0) seekAll(0);
      clockRef.current = { wall: performance.now(), t: startAt };
      if (baseVideoRef.current) {
        baseVideoRef.current.currentTime = startAt;
        baseVideoRef.current.play().catch(() => {});
      }
      if (motionVideoRef.current) {
        motionVideoRef.current.currentTime = startAt;
        motionVideoRef.current.play().catch(() => {});
      }
    } else {
      if (baseVideoRef.current) baseVideoRef.current.pause();
      if (motionVideoRef.current) motionVideoRef.current.pause();
      clockRef.current = null;
    }
  }, [isPlaying, effectiveDuration, seekAll]);

  const handleRestart = useCallback(() => {
    seekAll(0);
    if (!isPlaying) {
      setIsPlaying(true);
      clockRef.current = { wall: performance.now(), t: 0 };
      if (baseVideoRef.current) baseVideoRef.current.play().catch(() => {});
      if (motionVideoRef.current) motionVideoRef.current.play().catch(() => {});
    }
  }, [isPlaying, seekAll]);

  // Transport clock. Uses the media element when one drives playback, otherwise
  // a wall clock so text-only projects can still be scrubbed.
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
      return;
    }

    const tick = () => {
      const mediaEl = motionVideoRef.current || baseVideoRef.current;
      let t: number;
      if (mediaEl && !mediaEl.paused && Number.isFinite(mediaEl.currentTime)) {
        t = mediaEl.currentTime;
        clockRef.current = { wall: performance.now(), t };
      } else if (clockRef.current) {
        t = clockRef.current.t + (performance.now() - clockRef.current.wall) / 1000;
      } else {
        t = currentTimeRef.current + 1 / 30;
      }

      if (!Number.isFinite(t)) t = 0;

      if (t >= effectiveDuration - 0.02) {
        seekAll(0);
        if (baseVideoRef.current) baseVideoRef.current.play().catch(() => {});
        if (motionVideoRef.current) motionVideoRef.current.play().catch(() => {});
        clockRef.current = { wall: performance.now(), t: 0 };
      } else {
        setCurrentTime(t);
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    };
  }, [isPlaying, effectiveDuration, seekAll]);

  const handleSendRePrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (rePromptText.trim()) {
      onRePrompt(rePromptText.trim());
      setRePromptText('');
      setIsRePromptOpen(false);
    }
  };

  const formatTimecode = (sec: number) => {
    const safe = Number.isFinite(sec) ? Math.max(0, sec) : 0;
    const m = Math.floor(safe / 60);
    const s = Math.floor(safe % 60);
    const ms = Math.floor((safe % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const canTransport = !!selectedClipUrl || !!motionVideoUrl || hasLiveScenes;
  const showBaseVideo = !!selectedClipUrl && displayMode !== 'motion-only';
  // No rendered video? Show the live CSS layer even if the switch says otherwise.
  const effectiveSource: PreviewSource =
    motionVideoUrl || !hasLiveScenes ? previewSource : 'live';
  const showRenderedVideo =
    !!motionVideoUrl && displayMode !== 'video-only' && effectiveSource === 'rendered';
  const showLiveScenes = displayMode !== 'video-only' && effectiveSource === 'live' && hasLiveScenes;

  const alphaLabel = !video
    ? null
    : video.alphaMode === 'alpha'
    ? 'Alpha'
    : video.alphaMode === 'key'
    ? 'Keyed'
    : 'Opaque';

  return (
    <div className="flex-1 h-full flex flex-col bg-[#141414] border border-[#2d2d2d] rounded-xl overflow-hidden shadow-2xl">
      {/* Top Theater Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#1e1e1e] border-b border-[#3e3e3e] gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
            <Film className="w-4 h-4 text-amber-400" />
            <span>Preview Theater</span>
          </div>

          <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
            1080p • {effectiveDuration.toFixed(1)}s
          </span>

          {alphaLabel && (
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                video?.alphaMode === 'alpha'
                  ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                  : 'text-orange-300 bg-orange-400/10 border-orange-400/20'
              }`}
              title={
                video?.alphaMode === 'alpha'
                  ? 'Rendered with a real VP9 alpha channel — composites directly over your footage'
                  : 'No alpha support in this browser: rendered over a key colour, auto chroma-keyed when applied'
              }
            >
              {alphaLabel}
              {video?.alphaMode === 'key' && video.keyColor ? ` ${video.keyColor}` : ''}
            </span>
          )}

          {video && video.cssAnimationSupport === false && scenes.length > 0 && (
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded border border-red-500/30 text-red-400 bg-red-500/10 flex items-center gap-1"
              title="This browser rasterizes SVG images in static mode, so CSS animations are frozen in the rendered file."
            >
              <AlertTriangle className="w-3 h-3" /> CSS frozen
            </span>
          )}

          {/* Source switcher: rendered WebM vs live CSS */}
          {motionVideoUrl && hasLiveScenes && (
            <div className="flex items-center bg-[#141414] rounded-lg p-0.5 border border-[#3e3e3e]">
              <button
                type="button"
                onClick={() => setPreviewSource('rendered')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  effectiveSource === 'rendered'
                    ? 'bg-[#2a2a2a] text-amber-400 shadow-sm'
                    : 'text-[#808080] hover:text-white'
                }`}
                title="Play the rendered WebM overlay"
              >
                Rendered
              </button>
              <button
                type="button"
                onClick={() => setPreviewSource('live')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  effectiveSource === 'live'
                    ? 'bg-[#2a2a2a] text-amber-400 shadow-sm'
                    : 'text-[#808080] hover:text-white'
                }`}
                title="Scrub the raw HTML/CSS animation live (great while editing code)"
              >
                Live CSS
              </button>
            </div>
          )}

          {/* Display Mode Switcher (when source clip & motion graphic both exist) */}
          {selectedClipUrl && motionVideoUrl && (
            <div className="flex items-center bg-[#141414] rounded-lg p-0.5 border border-[#3e3e3e]">
              <button
                type="button"
                onClick={() => setDisplayMode('composite')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  displayMode === 'composite'
                    ? 'bg-[#2a2a2a] text-amber-400 shadow-sm'
                    : 'text-[#808080] hover:text-white'
                }`}
                title="Source Video with Motion Graphics Overlay"
              >
                🎬 Overlay
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('motion-only')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  displayMode === 'motion-only'
                    ? 'bg-[#2a2a2a] text-amber-400 shadow-sm'
                    : 'text-[#808080] hover:text-white'
                }`}
                title="Motion Graphic Only (Transparent Alpha)"
              >
                ✨ Motion
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('video-only')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  displayMode === 'video-only'
                    ? 'bg-[#2a2a2a] text-amber-400 shadow-sm'
                    : 'text-[#808080] hover:text-white'
                }`}
                title="Source Video Only"
              >
                🎞️ Source
              </button>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {result && (
            <>
              <button
                type="button"
                onClick={() => setShowCodeEditor((prev) => !prev)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                  showCodeEditor
                    ? 'bg-amber-400/10 text-amber-400 border-amber-400/40'
                    : 'bg-[#252525] text-[#a0a0a0] hover:text-white border-[#3e3e3e]'
                }`}
                title="View and manually tweak generated HTML/CSS code"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Code ✏️</span>
                {showCodeEditor ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {isDirty && onRenderFromCode && (
                <button
                  type="button"
                  onClick={onRenderFromCode}
                  disabled={isRendering}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors bg-emerald-500/10 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/20 disabled:opacity-40"
                  title="Re-render the overlay video from your edited code (no AI call)"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRendering ? 'animate-spin' : ''}`} />
                  <span>{isRendering ? 'Rendering' : 'Re-render'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsRePromptOpen((prev) => !prev)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                  isRePromptOpen
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/40'
                    : 'bg-[#252525] text-[#a0a0a0] hover:text-white border-[#3e3e3e]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Re-Prompt</span>
              </button>

              <button
                type="button"
                onClick={onApply}
                className="flex items-center gap-1 px-3.5 py-1 rounded text-xs font-bold bg-amber-400 hover:bg-amber-300 text-black shadow-md shadow-amber-400/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                title={
                  isDirty
                    ? 'Re-renders from your edited code, then adds the overlay to the timeline'
                    : 'Adds the rendered motion graphic overlay to the timeline'
                }
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Apply to Timeline</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Re-Prompt Drawer */}
      {isRePromptOpen && (
        <form
          onSubmit={handleSendRePrompt}
          className="flex items-center gap-2 p-2 bg-[#1c1c1c] border-b border-purple-500/30 px-4"
        >
          <input
            type="text"
            value={rePromptText}
            onChange={(e) => setRePromptText(e.target.value)}
            placeholder="Describe changes... e.g. 'make the lower third blue and add an animated arrow pointing right'"
            autoFocus
            className="flex-1 bg-[#141414] border border-[#3e3e3e] rounded text-xs text-white placeholder-[#606060] focus:outline-none focus:border-purple-400 px-3 py-1.5"
          />
          <button
            type="submit"
            disabled={!rePromptText.trim()}
            className="flex items-center gap-1 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-white rounded text-xs font-medium transition-colors"
          >
            <Send className="w-3 h-3" />
            <span>Generate Revision</span>
          </button>
        </form>
      )}

      {/* Main Viewport Screen */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center p-4 bg-[#0a0a0a] overflow-hidden select-none">
        {/* Transparent Checkerboard Pattern Background for Alpha Mode */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(#3e3e3e 1px, transparent 1px), radial-gradient(#3e3e3e 1px, #0a0a0a 1px)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 10px 10px',
          }}
        />

        {/* 16:9 Theater Screen Frame */}
        <div
          ref={screenRef}
          className="relative w-full h-full max-w-[1920px] max-h-[1080px] aspect-video bg-transparent rounded-lg overflow-hidden border border-[#2d2d2d] shadow-2xl flex items-center justify-center"
          style={{ ['--scene-scale' as any]: sceneScale }}
        >
          {/* Layer 1: Source Video */}
          {showBaseVideo && (
            <video
              ref={baseVideoRef}
              src={selectedClipUrl || undefined}
              muted={isMuted}
              playsInline
              preload="metadata"
              className="absolute inset-0 w-full h-full object-contain"
            />
          )}

          {/* Layer 2a: Rendered transparent WebM overlay */}
          {showRenderedVideo && (
            <video
              ref={motionVideoRef}
              src={motionVideoUrl || undefined}
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
            />
          )}

          {/* Layer 2b: Live HTML/CSS scenes, scrubbed via the Web Animations API */}
          {showLiveScenes &&
            scenes.map((scene, index) => (
              <div
                key={`${index}-${scene.enterAt}`}
                className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center overflow-hidden"
              >
                <SceneOverlay
                  scene={
                    index === 0 && editedHtmlCss.trim()
                      ? { ...scene, htmlCss: editedHtmlCss }
                      : scene
                  }
                  time={currentTime}
                  playing={isPlaying}
                />
              </div>
            ))}

          {/* Standby Empty State */}
          {!selectedClipUrl && !motionVideoUrl && !hasLiveScenes && (
            <div className="flex flex-col items-center justify-center text-center p-8 space-y-3 z-20">
              <div className="w-14 h-14 rounded-2xl bg-[#1a1a1a] border border-[#3e3e3e] flex items-center justify-center shadow-inner">
                <Sparkles className="w-7 h-7 text-amber-400 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white">Full-Resolution Motion Studio</h4>
                <p className="text-xs text-[#808080] max-w-sm">
                  Drop a video clip on the left or type your dialogue to generate synced motion graphics.
                </p>
              </div>
            </div>
          )}

          {/* Standby State (Clip loaded, awaiting generation) */}
          {selectedClipUrl && !motionVideoUrl && !hasLiveScenes && !isGenerating && (
            <div className="absolute top-3 right-3 z-30 bg-black/75 backdrop-blur px-3 py-1 rounded-md border border-[#3e3e3e] text-[11px] text-[#a0a0a0] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Source Video Loaded • Click Generate
            </div>
          )}
        </div>
      </div>

      {/* Code Editor Panel */}
      {showCodeEditor && (
        <div className="border-t border-[#3e3e3e] bg-[#141414] p-3 max-h-72 overflow-y-auto">
          <CodeEditor
            code={editedHtmlCss}
            onChange={setEditedHtmlCss}
            originalCode={originalHtmlCss}
            onReset={onResetCode}
          />
        </div>
      )}

      {/* Bottom Transport Scrubber Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1a] border-t border-[#3e3e3e] text-xs gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!canTransport}
            className="w-8 h-8 rounded-lg bg-[#252525] hover:bg-amber-400 hover:text-black text-white flex items-center justify-center transition-colors disabled:opacity-40"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={handleRestart}
            disabled={!canTransport}
            className="w-8 h-8 rounded-lg bg-[#252525] hover:bg-[#333] text-[#a0a0a0] hover:text-white flex items-center justify-center transition-colors disabled:opacity-40"
            title="Restart from beginning"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="w-8 h-8 rounded-lg bg-[#252525] hover:bg-[#333] text-[#a0a0a0] hover:text-white flex items-center justify-center transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-[#808080]" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
          </button>

          <div className="font-mono text-[11px] text-[#a0a0a0] ml-2">
            <span className="text-white font-semibold">{formatTimecode(currentTime)}</span> /{' '}
            <span>{formatTimecode(effectiveDuration)}</span>
          </div>
        </div>

        <div className="flex-1 flex items-center">
          <input
            type="range"
            min={0}
            max={effectiveDuration || 15}
            step={0.05}
            value={Math.min(currentTime, effectiveDuration || 15)}
            onChange={(e) => seekAll(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
        </div>

        <div className="text-[11px] text-[#808080] font-medium truncate max-w-[200px] flex items-center gap-1">
          {scenes.length > 0 && (
            <span className="flex items-center gap-1 text-[#a0a0a0]">
              <Layers className="w-3.5 h-3.5" />
              {scenes.length} scene{scenes.length === 1 ? '' : 's'}
            </span>
          )}
          <span className="truncate">{selectedClipName ? `🎬 ${selectedClipName}` : 'No clip selected'}</span>
        </div>
      </div>
    </div>
  );
};
