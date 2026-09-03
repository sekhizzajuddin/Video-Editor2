import React, { useCallback, useState, useEffect } from 'react';
import {
  Bug,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Loader2,
  Wand2,
  Copy,
  Check,
} from 'lucide-react';
import {
  createSceneStage,
  destroySceneStage,
  probeCaptureCapabilities,
  probeSceneMotion,
} from '@/utils/cssSceneRasterizer';
import { renderMotionGraphicToVideo } from '@/utils/motionGraphicRenderer';
import { DEMO_SCENE_HTML } from './demoScene';

type CheckState = 'idle' | 'running' | 'pass' | 'fail';

interface Check {
  id: string;
  label: string;
  hint: string;
  state: CheckState;
  detail: string;
}

const INITIAL_CHECKS: Check[] = [
  {
    id: 'webcodecs',
    label: 'WebCodecs VideoEncoder',
    hint: 'Required for frame-accurate offline rendering.',
    state: 'idle',
    detail: '',
  },
  {
    id: 'alpha',
    label: 'VP9 alpha channel',
    hint: 'Lets the overlay be transparent without chroma keying.',
    state: 'idle',
    detail: '',
  },
  {
    id: 'svg',
    label: 'SVG foreignObject raster',
    hint: 'The browser can rasterize an HTML scene into a canvas at all.',
    state: 'idle',
    detail: '',
  },
  {
    id: 'css',
    label: 'CSS animation capture',
    hint: 'Paused, time-seeked CSS animations inside an SVG foreignObject.',
    state: 'idle',
    detail: '',
  },
  {
    id: 'scene',
    label: 'Your generated scene',
    hint: 'Rasterizes the AI scene currently loaded and checks whether it moves.',
    state: 'idle',
    detail: '',
  },
  {
    id: 'render',
    label: 'Demo scene → WebM',
    hint: 'Renders a built-in Vox-style scene and muxes it to WebM.',
    state: 'idle',
    detail: '',
  },
];

export interface DiagnosticsPanelProps {
  /** Loads the reference scene into the code editor. */
  onLoadDemo?: (html: string) => void;
  /** The AI-generated scene currently loaded, if any (scenes[0]). */
  sceneHtml?: string | null;
}

/**
 * Self-test for the generative motion pipeline.
 *
 * The workspace depends on three browser capabilities (WebCodecs, VP9 alpha,
 * CSS-animation rasterization). When any of them is missing the overlay silently
 * degrades, so this panel reports exactly which link in the chain is broken —
 * and proves the rest works without spending an AI call.
 */
export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  onLoadDemo,
  sceneHtml = null,
}) => {
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState<Check[]>(INITIAL_CHECKS);
  const [running, setRunning] = useState(false);
  const [demoUrl, setDemoUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  useEffect(() => {
    return () => {
      if (demoUrl) URL.revokeObjectURL(demoUrl);
    };
  }, [demoUrl]);

  const patch = useCallback((id: string, next: Partial<Check>) => {
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, ...next } : c)));
  }, []);

  const runSelfTest = useCallback(async () => {
    setRunning(true);
    setChecks(INITIAL_CHECKS.map((c) => ({ ...c, state: 'running', detail: '' })));

    // 1. WebCodecs availability
    let hasEncoder = false;
    try {
      hasEncoder = typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
      patch('webcodecs', {
        state: hasEncoder ? 'pass' : 'fail',
        detail: hasEncoder ? 'available' : 'missing — the MediaRecorder fallback will be used',
      });
    } catch {
      patch('webcodecs', { state: 'fail', detail: 'missing' });
    }

    // 2. VP9 alpha support
    let alphaCodec: string | null = null;
    if (hasEncoder) {
      for (const codec of ['vp09.00.41.08', 'vp09.00.40.08', 'vp09.00.10.08']) {
        try {
          const support = await VideoEncoder.isConfigSupported({
            codec,
            width: 1920,
            height: 1080,
            bitrate: 8_000_000,
            alpha: 'keep',
          });
          if (support.supported) {
            alphaCodec = codec;
            break;
          }
        } catch {
          /* try next */
        }
      }
    }
    patch('alpha', {
      state: alphaCodec ? 'pass' : 'fail',
      detail: alphaCodec
        ? `${alphaCodec} — real transparency`
        : 'unsupported — overlays render on a magenta plate and auto chroma-key',
    });

    // 3. SVG rasterization + CSS animation capture
    let caps: { svgOk: boolean; cssAnimOk: boolean; mode: string } = {
      svgOk: false,
      cssAnimOk: false,
      mode: 'static',
    };
    try {
      caps = await probeCaptureCapabilities();
    } catch {
      /* leave defaults */
    }
    patch('svg', {
      state: caps.svgOk ? 'pass' : 'fail',
      detail: caps.svgOk
        ? 'HTML scenes rasterize into the canvas'
        : 'SVG images cannot be rasterized — HTML scenes will not appear at all',
    });
    patch('css', {
      state: caps.cssAnimOk ? 'pass' : 'fail',
      detail: caps.cssAnimOk
        ? 'seeked CSS animations rasterize correctly (native path)'
        : caps.svgOk
        ? 'static SVG mode → using the built-in @keyframes evaluator instead'
        : 'SVG rasterization is unavailable, so animation capture is moot',
    });

    // 4. The user's own generated scene: does it rasterize, and does it move?
    //    This is the discriminator between "the pipeline is broken" and "the AI
    //    wrote markup this browser cannot rasterize".
    if (!sceneHtml || !sceneHtml.trim()) {
      patch('scene', { state: 'idle', detail: 'no generated scene yet' });
    } else {
      const stage = createSceneStage(sceneHtml, { width: 1280, height: 720, transparent: true });
      if (!stage) {
        patch('scene', { state: 'fail', detail: 'could not build a scene stage' });
      } else {
        try {
          const css = await probeSceneMotion(stage, 'css', [0.1, 1.2]);
          const baked = await probeSceneMotion(stage, 'js', [0.1, 1.2]);
          const animated = stage.animated.length;
          const ok = css.rasterized || baked.rasterized;
          patch('scene', {
            state: ok ? 'pass' : 'fail',
            detail: ok
              ? `rasterized • ${animated} animated nodes • native seek ${
                  css.differs ? 'moves' : 'is static'
                } • baked ${baked.differs ? 'moves' : 'is static'}`
              : `nothing rasterized for this scene (${animated} animated nodes found)`,
          });
        } catch (err) {
          patch('scene', { state: 'fail', detail: `probe threw: ${String(err)}` });
        } finally {
          destroySceneStage(stage);
        }
      }
    }

    // 5. End-to-end demo render
    try {
      const started = performance.now();
      const rendered = await renderMotionGraphicToVideo(
        {
          width: 1280,
          height: 720,
          fps: 24,
          duration: 3,
          canvasElements: [],
          htmlCssScenes: [
            {
              enterAt: 0,
              exitAt: 3,
              description: 'Demo scene',
              htmlCss: DEMO_SCENE_HTML,
            },
          ],
        },
        () => {},
        { transparent: true }
      );
      const elapsed = Math.round(performance.now() - started);
      const ok = rendered.blob.size > 1024;
      patch('render', {
        state: ok ? 'pass' : 'fail',
        detail: ok
          ? `${rendered.frameCount} frames in ${elapsed}ms • ${(rendered.blob.size / 1024).toFixed(
              0
            )} KB • ${rendered.alphaMode}`
          : `produced ${rendered.blob.size} bytes — encoding failed`,
      });
      if (ok) {
        if (demoUrl) URL.revokeObjectURL(demoUrl);
        setDemoUrl(URL.createObjectURL(rendered.blob));
      }
    } catch (err: any) {
      patch('render', { state: 'fail', detail: err?.message || 'render threw' });
    }

    setRunning(false);
  }, [patch, demoUrl]);

  /** Copies the full report so it can be pasted into a bug report. */
  const copyReport = useCallback(async () => {
    const lines = [
      `ProCut generative pipeline report`,
      `user agent: ${navigator.userAgent}`,
      ...checks.map(
        (c) => `${c.state.toUpperCase().padEnd(7)} ${c.label}${c.detail ? ` — ${c.detail}` : ''}`
      ),
    ];
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.log(text);
    }
  }, [checks]);

  const StatusIcon: React.FC<{ state: CheckState }> = ({ state }) => {
    if (state === 'running') return <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />;
    if (state === 'pass') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    if (state === 'fail') return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    return <span className="w-3.5 h-3.5 inline-block rounded-full border border-[#4a4a4a]" />;
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#3e3e3e] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#a0a0a0] hover:text-white transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Bug className="w-3.5 h-3.5" />
          Pipeline self-test
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-[#2d2d2d] pt-2">
          <p className="text-[11px] text-[#808080] leading-snug">
            Verifies every capability the overlay pipeline depends on, without an AI call.
          </p>

          <div className="space-y-1.5">
            {checks.map((check) => (
              <div key={check.id} className="flex items-start gap-2">
                <span className="mt-0.5">
                  <StatusIcon state={check.state} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-white">{check.label}</div>
                  <div className="text-[10px] text-[#707070] leading-snug">{check.hint}</div>
                  {check.detail && (
                    <div
                      className={`text-[10px] mt-0.5 ${
                        check.state === 'fail' ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {check.detail}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {demoUrl && (
            <video
              src={demoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full rounded-lg border border-[#3e3e3e] bg-black aspect-video object-contain"
            />
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={runSelfTest}
              disabled={running}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-[#252525] text-white border border-[#3e3e3e] hover:border-amber-400 hover:text-amber-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bug className="w-3.5 h-3.5" />}
              {running ? 'Running…' : 'Run self-test'}
            </button>

            {onLoadDemo && (
              <button
                type="button"
                onClick={() => onLoadDemo(DEMO_SCENE_HTML)}
                className="py-1.5 px-2.5 rounded-lg text-[11px] font-semibold bg-[#252525] text-[#a0a0a0] border border-[#3e3e3e] hover:border-amber-400 hover:text-amber-400 transition-colors flex items-center gap-1.5"
                title="Load the reference scene into the code editor"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Demo code
              </button>
            )}

            <button
              type="button"
              onClick={copyReport}
              className="py-1.5 px-2.5 rounded-lg text-[11px] font-semibold bg-[#252525] text-[#a0a0a0] border border-[#3e3e3e] hover:border-amber-400 hover:text-amber-400 transition-colors flex items-center gap-1.5"
              title="Copy the full report (browser + every check) to the clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy report'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
