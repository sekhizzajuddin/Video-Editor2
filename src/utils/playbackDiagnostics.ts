/**
 * playbackDiagnostics.ts
 *
 * Real-time playback health monitor, flight recorder, and incident diagnostic logger.
 *
 * Designed to answer: "Why is the preview player struggling, buffering, or freezing?"
 *
 * Captures:
 *  - High-precision timeline state at the moment of struggle (active tracks, clips, split segments, effects, keyframes, transitions)
 *  - Media decoders in pool (readyState, seeking status, time drift, buffer ranges, error states)
 *  - Canvas rendering engine statistics (render time ms, offscreen canvas count, dimensions)
 *  - Comprehensive hardware & system environment (CPU cores, device memory, GPU renderer, OS, resolution)
 *  - Rolling black-box flight recorder of the last 100 playback events
 *  - Automated heuristic root-cause analysis (pinpoints specific conflicting clips, stalled decoders, or heavy shaders)
 *  - 1-click Download Diagnostic Log (.json) and Copy Summary
 */

import { useEditorStore } from '@/store/editorStore';
import { getCurrentPerfState } from '@/utils/performanceMonitor';

export type IncidentType =
  | 'BUFFERING_STARTED'
  | 'SUSTAINED_BUFFERING'
  | 'PLAYHEAD_STALL'
  | 'FPS_COLLAPSE'
  | 'SEEK_TIMEOUT'
  | 'RENDER_CRASH'
  | 'MANUAL_SNAPSHOT';

export interface PlaybackFlightEvent {
  timeMs: number;
  timeStr: string;
  category: 'seek' | 'boundary' | 'buffer' | 'drift' | 'state' | 'render' | 'error';
  message: string;
  data?: any;
}

export interface PlaybackIncident {
  id: string;
  timestamp: string;
  timestampMs: number;
  type: IncidentType;
  triggerReason: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  playhead: {
    currentTime: number;
    isPlaying: boolean;
    isBuffering: boolean;
    isScrubbing: boolean;
    playbackSpeed: number;
    fps: number;
  };
  timeline: {
    totalDuration: number;
    trackCount: number;
    activeTracks: {
      id: string;
      name: string;
      type: string;
      isMuted?: boolean;
      isHidden?: boolean;
      activeClipIds: string[];
    }[];
    activeClips: {
      id: string;
      trackId: string;
      trackType: string;
      name: string;
      mediaId: string;
      startTime: number;
      duration: number;
      trimStart: number;
      speed: number;
      speedRampCount?: number;
      speedFramesCount?: number;
      isReversed?: boolean;
      freezeFrame?: number;
      splitGroupId?: string;
      effectsSummary: string[];
      effects: {
        hasFxSettings: boolean;
        fxType?: string;
        fxIntensity?: number;
        hasCustomHtmlCss?: boolean;
        chromaKeyEnabled: boolean;
        lumaKeyEnabled: boolean;
        hasCurves: boolean;
        hasColorWheels: boolean;
        hasColorAdjustments: boolean;
        objectRemovalEnabled: boolean;
        aiBackgroundEnabled: boolean;
        maskEnabled: boolean;
        hasLut: boolean;
      };
      transitions: {
        transitionIn?: any;
        transitionOut?: any;
      };
      animationsCount: number;
    }[];
    surroundingClips: {
      id: string;
      trackId: string;
      startTime: number;
      duration: number;
      deltaSec: number;
    }[];
  };
  decoders: any[];
  canvasEngine: {
    canvasWidth: number;
    canvasHeight: number;
    aspectRatio: string;
    zoom: number;
    offscreenPoolCount: number;
    lastFrameDurationMs: number;
    drawQueueCount: number;
    perfDowngraded: boolean;
  };
  system: {
    userAgent: string;
    platform: string;
    cores: number;
    deviceMemoryGB?: number;
    jsHeapUsedMB?: number;
    jsHeapTotalMB?: number;
    screenResolution: string;
    devicePixelRatio: number;
    gpuRenderer: string;
  };
  recentFlightEvents: PlaybackFlightEvent[];
  analysis: {
    suspectedCulprit: string;
    diagnosticHints: string[];
  };
}

class PlaybackDiagnosticsService {
  private flightEvents: PlaybackFlightEvent[] = [];
  private maxFlightEvents = 100;
  private incidents: PlaybackIncident[] = [];
  private maxIncidents = 25;
  private listeners = new Set<(incident: PlaybackIncident) => void>();
  private lastIncidentTimeMs = 0;
  private minIncidentDebounceMs = 800; // prevent incident flood

  // Custom getters injected dynamically from modules to avoid circular dependencies
  private getDecodersDetailFn: (() => any[]) | null = null;
  private getCanvasEngineDiagnosticsFn: (() => any) | null = null;

  public registerDecodersDetailProvider(fn: () => any[]) {
    this.getDecodersDetailFn = fn;
  }

  public registerCanvasEngineDiagnosticsProvider(fn: () => any) {
    this.getCanvasEngineDiagnosticsFn = fn;
  }

  /**
   * Record a transient playback flight event into the circular black-box buffer.
   */
  public recordEvent(category: PlaybackFlightEvent['category'], message: string, data?: any) {
    const now = performance.now();
    const event: PlaybackFlightEvent = {
      timeMs: +now.toFixed(1),
      timeStr: new Date().toLocaleTimeString('en-US', { hour12: false }) + '.' + String(Math.floor(now % 1000)).padStart(3, '0'),
      category,
      message,
      data,
    };
    this.flightEvents.push(event);
    if (this.flightEvents.length > this.maxFlightEvents) {
      this.flightEvents.shift();
    }
  }

  /**
   * Capture a full Diagnostic Incident Snapshot.
   */
  public recordIncident(
    type: IncidentType,
    triggerReason: string,
    extraData?: any
  ): PlaybackIncident | null {
    const now = performance.now();
    if (type !== 'MANUAL_SNAPSHOT' && now - this.lastIncidentTimeMs < this.minIncidentDebounceMs) {
      return null;
    }
    this.lastIncidentTimeMs = now;

    const store = useEditorStore.getState();
    const ct = store.currentTime;
    const tracks = store.tracks || [];
    const perfState = getCurrentPerfState();

    // 1. Collect Timeline state
    const activeTracks: PlaybackIncident['timeline']['activeTracks'] = [];
    const activeClips: PlaybackIncident['timeline']['activeClips'] = [];
    const surroundingClips: PlaybackIncident['timeline']['surroundingClips'] = [];

    for (const track of tracks) {
      const activeInTrack: string[] = [];
      for (const clip of track.clips || []) {
        const isNear = ct >= clip.startTime - 1.5 && ct <= clip.startTime + clip.duration + 1.5;
        if (isNear) {
          surroundingClips.push({
            id: clip.id,
            trackId: track.id,
            startTime: +clip.startTime.toFixed(3),
            duration: +clip.duration.toFixed(3),
            deltaSec: +(clip.startTime - ct).toFixed(3),
          });
        }

        const isActive = !clip.disabled && ct >= clip.startTime && ct < clip.startTime + clip.duration + 0.001;
        if (isActive) {
          activeInTrack.push(clip.id);

          const fx = clip.fxSettings;
          const cf = clip.colorFilters;
          const effectsSummary: string[] = [];
          if (fx && fx.enabled !== false) effectsSummary.push(`FX:${fx.type}`);
          if (clip.chromaKey?.enabled) effectsSummary.push('ChromaKey');
          if (clip.lumaKey?.enabled) effectsSummary.push('LumaKey');
          if (clip.objectRemoval?.enabled) effectsSummary.push('ObjectRemoval');
          if (clip.aiBackground?.enabled) effectsSummary.push(`AiBg:${clip.aiBackground.mode || 'remove'}`);
          if (clip.mask?.enabled) effectsSummary.push(`Mask:${clip.mask.type}`);
          if (cf?.curves) effectsSummary.push('Curves');
          if (cf?.shadows || cf?.midtones || cf?.highlights) effectsSummary.push('ColorWheels');
          if (clip.lut?.mediaId || clip.lutFilter?.mediaId) effectsSummary.push('LUT');

          activeClips.push({
            id: clip.id,
            trackId: track.id,
            trackType: track.type,
            name: clip.name || 'Untitled Clip',
            mediaId: clip.mediaId,
            startTime: +clip.startTime.toFixed(3),
            duration: +clip.duration.toFixed(3),
            trimStart: +(clip.trimStart || 0).toFixed(3),
            speed: clip.speed || 1,
            speedRampCount: clip.speedRamp?.length,
            speedFramesCount: (clip as any).speedFrames?.length,
            isReversed: clip.isReversed,
            freezeFrame: clip.freezeFrame,
            splitGroupId: (clip as any).splitGroupId,
            effectsSummary,
            effects: {
              hasFxSettings: !!fx && fx.enabled !== false,
              fxType: fx?.type,
              fxIntensity: fx?.intensity,
              hasCustomHtmlCss: !!fx?.customHtmlCss,
              chromaKeyEnabled: !!clip.chromaKey?.enabled,
              lumaKeyEnabled: !!clip.lumaKey?.enabled,
              hasCurves: !!cf?.curves,
              hasColorWheels: !!(cf?.shadows || cf?.midtones || cf?.highlights),
              hasColorAdjustments: !!(cf?.exposure || cf?.contrast !== 100 || cf?.saturation !== 100),
              objectRemovalEnabled: !!clip.objectRemoval?.enabled,
              aiBackgroundEnabled: !!clip.aiBackground?.enabled,
              maskEnabled: !!clip.mask?.enabled,
              hasLut: !!(clip.lut?.mediaId || clip.lutFilter?.mediaId),
            },
            transitions: {
              transitionIn: clip.transitionIn,
              transitionOut: clip.transitionOut,
            },
            animationsCount: Object.keys(clip.animations || {}).length,
          });
        }
      }
      activeTracks.push({
        id: track.id,
        name: track.name || track.id,
        type: track.type,
        isMuted: track.muted,
        isHidden: track.hidden,
        activeClipIds: activeInTrack,
      });
    }

    // 2. Collect Decoders State
    const decoders = this.getDecodersDetailFn ? this.getDecodersDetailFn() : [];

    // 3. Collect Canvas Engine State
    const canvasDiag = this.getCanvasEngineDiagnosticsFn ? this.getCanvasEngineDiagnosticsFn() : {};

    // 4. Collect System Info
    const system = this.getSystemProfile();

    // 5. Automated Root Cause Analysis
    const analysis = this.analyzeRootCause({
      type,
      triggerReason,
      currentTime: ct,
      activeClips,
      decoders,
      canvasDiag,
      perfState,
      extraData,
    });

    const severity: PlaybackIncident['severity'] =
      type === 'RENDER_CRASH' ? 'critical' :
      type === 'SUSTAINED_BUFFERING' || type === 'PLAYHEAD_STALL' ? 'error' :
      type === 'BUFFERING_STARTED' || type === 'FPS_COLLAPSE' ? 'warning' : 'info';

    const incident: PlaybackIncident = {
      id: `inc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      timestampMs: +now.toFixed(1),
      type,
      triggerReason,
      severity,
      playhead: {
        currentTime: +ct.toFixed(3),
        isPlaying: store.isPlaying,
        isBuffering: store.isBuffering,
        isScrubbing: store.isScrubbing,
        playbackSpeed: store.playbackSpeed || 1,
        fps: perfState.fps,
      },
      timeline: {
        totalDuration: +store.totalDuration.toFixed(3),
        trackCount: tracks.length,
        activeTracks,
        activeClips,
        surroundingClips,
      },
      decoders,
      canvasEngine: {
        canvasWidth: canvasDiag.canvasWidth || 1920,
        canvasHeight: canvasDiag.canvasHeight || 1080,
        aspectRatio: store.aspectRatio || '16:9',
        zoom: canvasDiag.zoom || (store as any).viewport?.zoom || 1,
        offscreenPoolCount: canvasDiag.offscreenPoolCount || 0,
        lastFrameDurationMs: +(canvasDiag.lastFrameDurationMs || 0).toFixed(2),
        drawQueueCount: canvasDiag.lastDrawQueueCount || 0,
        perfDowngraded: !!store.perfDowngraded,
      },
      system,
      recentFlightEvents: [...this.flightEvents],
      analysis,
    };

    this.incidents.unshift(incident);
    if (this.incidents.length > this.maxIncidents) {
      this.incidents.pop();
    }

    // Notify listeners & dispatch event
    for (const listener of this.listeners) {
      try {
        listener(incident);
      } catch (e) {
        console.warn('[PlaybackDiagnostics] Listener error:', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('procut-playback-incident', { detail: incident }));
    }

    console.warn(`[PlaybackDiagnostics] Incident captured [${type}]:`, triggerReason, analysis);
    return incident;
  }

  /**
   * Automated Root Cause Analyzer:
   * Inspects decoders, active clips, effects, and system state to diagnose the real cause.
   */
  private analyzeRootCause(params: {
    type: IncidentType;
    triggerReason: string;
    currentTime: number;
    activeClips: PlaybackIncident['timeline']['activeClips'];
    decoders: any[];
    canvasDiag: any;
    perfState: any;
    extraData: any;
  }): { suspectedCulprit: string; diagnosticHints: string[] } {
    const hints: string[] = [];
    let culprit = 'Unknown bottleneck';

    const { type, activeClips, decoders, canvasDiag, perfState, currentTime } = params;

    // Check 1: Decoders stalled in seek / readyState
    const seekingDecoders = decoders.filter((d) => d.seeking);
    const lowReadyDecoders = decoders.filter((d) => d.readyState < 2);
    const erroredDecoders = decoders.filter((d) => d.error);

    if (erroredDecoders.length > 0) {
      culprit = `Media decoding error on element ${erroredDecoders[0].clipId}: ${erroredDecoders[0].error}`;
      hints.push(`Check if media file is accessible or codec is supported by browser.`);
    } else if (lowReadyDecoders.length > 0) {
      const d = lowReadyDecoders[0];
      const matchingClip = activeClips.find((c) => c.id === d.clipId);
      culprit = `Decoder for clip "${matchingClip?.name || d.clipId}" stalled at ${d.readyStateText} (waiting for video frame data)`;
      hints.push(`The browser hardware video decoder has not loaded sufficient frames at time ${currentTime.toFixed(2)}s.`);
      if (matchingClip?.splitGroupId) {
        hints.push(`Clip is a split segment (splitGroupId: ${matchingClip.splitGroupId}). Ensure pre-roll decoders are warming up.`);
      }
    } else if (seekingDecoders.length > 0) {
      const d = seekingDecoders[0];
      const matchingClip = activeClips.find((c) => c.id === d.clipId);
      culprit = `Video element for clip "${matchingClip?.name || d.clipId}" is in prolonged seeking state`;
      hints.push(`The video element was instructed to seek to ${d.currentTime}s, but the browser has not fired 'seeked'.`);
    }

    // Check 2: Concurrent Multi-Track / Split Contention
    const activeVideoClips = activeClips.filter((c) => c.trackType === 'video');
    if (activeVideoClips.length > 2) {
      hints.push(`High density multi-track: ${activeVideoClips.length} video clips active concurrently. Chromium hardware decoder ceiling may be under pressure.`);
    }

    // Check 3: Heavy CPU Pixel Shaders
    const heavyEffectsCount = activeClips.reduce((acc, c) => {
      let count = 0;
      if (c.effects.hasCurves) count++;
      if (c.effects.hasColorWheels) count++;
      if (c.effects.hasFxSettings && c.effects.fxType !== 'custom_html') count++;
      if (c.effects.objectRemovalEnabled) count++;
      return acc + count;
    }, 0);

    if (heavyEffectsCount >= 2) {
      hints.push(`Multiple CPU pixel shaders active simultaneously (${heavyEffectsCount} passes). Canvas getImageData loop is heavy.`);
      if (canvasDiag.lastFrameDurationMs > 25) {
        culprit = `Canvas render pass took ${canvasDiag.lastFrameDurationMs}ms (> 16ms budget), starving video decoders of main-thread cycles.`;
      }
    }

    // Check 4: FPS Drop
    if (perfState.fps < 30) {
      hints.push(`Low frame rate detected: ${perfState.fps} FPS.`);
    }

    // Check 5: Playhead Stall
    if (type === 'PLAYHEAD_STALL') {
      culprit = `Playhead stalled: Playback clock stopped advancing at ${currentTime.toFixed(2)}s.`;
      hints.push(`Verify if audio context or video element playback rate is 0 or paused.`);
    }

    if (hints.length === 0) {
      hints.push(`No critical decoder stall found. Playback buffer recovered or transient seek settled.`);
      if (type === 'BUFFERING_STARTED') {
        culprit = `Transient decoder synchronization seek at playhead time ${currentTime.toFixed(2)}s.`;
      }
    }

    return {
      suspectedCulprit: culprit,
      diagnosticHints: hints,
    };
  }

  /**
   * System Profile Inspection:
   * Captures CPU cores, memory limits, devicePixelRatio, and GPU renderer.
   */
  private getSystemProfile(): PlaybackIncident['system'] {
    if (typeof window === 'undefined') {
      return {
        userAgent: 'SSR',
        platform: 'SSR',
        cores: 4,
        screenResolution: '1920x1080',
        devicePixelRatio: 1,
        gpuRenderer: 'Unknown',
      };
    }

    let gpuRenderer = 'Unknown GPU';
    try {
      const canvas = document.createElement('canvas');
      const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
      if (gl) {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
          gpuRenderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || gl.getParameter(gl.RENDERER) || 'WebGL';
        } else {
          gpuRenderer = gl.getParameter(gl.RENDERER) || 'WebGL';
        }
      }
    } catch {
      /* ignore */
    }

    const perfMem = (performance as any)?.memory;
    return {
      userAgent: navigator.userAgent || 'Unknown',
      platform: navigator.platform || 'Unknown',
      cores: navigator.hardwareConcurrency || 4,
      deviceMemoryGB: (navigator as any)?.deviceMemory,
      jsHeapUsedMB: perfMem?.usedJSHeapSize ? +(perfMem.usedJSHeapSize / (1024 * 1024)).toFixed(1) : undefined,
      jsHeapTotalMB: perfMem?.totalJSHeapSize ? +(perfMem.totalJSHeapSize / (1024 * 1024)).toFixed(1) : undefined,
      screenResolution: `${window.screen?.width || window.innerWidth}x${window.screen?.height || window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio || 1,
      gpuRenderer,
    };
  }

  public getIncidents(): PlaybackIncident[] {
    return [...this.incidents];
  }

  public getLatestIncident(): PlaybackIncident | null {
    return this.incidents[0] || null;
  }

  public getFlightEvents(): PlaybackFlightEvent[] {
    return [...this.flightEvents];
  }

  public clearIncidents() {
    this.incidents = [];
    this.flightEvents = [];
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('procut-playback-incident-cleared'));
    }
  }

  public subscribe(listener: (incident: PlaybackIncident) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Formats a complete human-readable diagnostic report with embedded JSON.
   */
  public generateReportString(targetIncident?: PlaybackIncident | null): string {
    const inc = targetIncident || this.getLatestIncident();
    const system = inc ? inc.system : this.getSystemProfile();
    const store = useEditorStore.getState();
    const ct = inc ? inc.playhead.currentTime : store.currentTime;

    const lines: string[] = [
      '================================================================================',
      'PROVISIONED PLAYBACK DIAGNOSTIC REPORT',
      `Generated: ${new Date().toISOString()}`,
      `Total Incidents Logged: ${this.incidents.length}`,
      '================================================================================',
      '',
      '--- 1. INCIDENT EXECUTIVE SUMMARY ---',
      `Primary Trigger: ${inc ? `${inc.type} - ${inc.triggerReason}` : 'Live Health Snapshot (No Active Incidents)'}`,
      `Playhead Position: ${ct.toFixed(3)}s`,
      `Playback Status: ${inc ? (inc.playhead.isBuffering ? 'BUFFERING' : inc.playhead.isPlaying ? 'PLAYING' : 'PAUSED') : (store.isBuffering ? 'BUFFERING' : store.isPlaying ? 'PLAYING' : 'PAUSED')}`,
      `FPS: ${inc ? inc.playhead.fps : getCurrentPerfState().fps}`,
      `Suspected Culprit: ${inc ? inc.analysis.suspectedCulprit : 'N/A'}`,
      '',
      'Diagnostic Hints:',
      ...(inc ? inc.analysis.diagnosticHints.map((h) => `  * ${h}`) : ['  * Player running smoothly.']),
      '',
      '--- 2. HARDWARE & SYSTEM PROFILE ---',
      `Browser / OS: ${system.userAgent}`,
      `Platform: ${system.platform}`,
      `CPU Cores: ${system.cores}`,
      `RAM (Device Memory): ${system.deviceMemoryGB ? `${system.deviceMemoryGB} GB` : 'N/A'}`,
      `JS Heap: ${system.jsHeapUsedMB ? `${system.jsHeapUsedMB} MB / ${system.jsHeapTotalMB} MB` : 'N/A'}`,
      `Screen: ${system.screenResolution} (DPR: ${system.devicePixelRatio})`,
      `GPU Renderer: ${system.gpuRenderer}`,
      '',
      '--- 3. TIMELINE & ACTIVE CLIPS AT INCIDENT ---',
    ];

    if (inc && inc.timeline.activeClips.length > 0) {
      lines.push(`Active Clips Count: ${inc.timeline.activeClips.length}`);
      for (const c of inc.timeline.activeClips) {
        lines.push(`  - Clip [${c.id}] on Track [${c.trackId}]: "${c.name}"`);
        lines.push(`      Start: ${c.startTime}s, Duration: ${c.duration}s, TrimStart: ${c.trimStart}s, Speed: ${c.speed}x`);
        if (c.splitGroupId) lines.push(`      SplitGroup: ${c.splitGroupId}`);
        if (c.effectsSummary.length > 0) lines.push(`      Effects: ${c.effectsSummary.join(', ')}`);
      }
    } else {
      lines.push('  No active clips at current playhead position.');
    }

    lines.push('', '--- 4. MEDIA DECODER POOL DETAILS ---');
    const decs = inc ? inc.decoders : (this.getDecodersDetailFn ? this.getDecodersDetailFn() : []);
    if (decs.length > 0) {
      for (const d of decs) {
        lines.push(`  - Element [${d.clipId}] (${d.type}):`);
        lines.push(`      ReadyState: ${d.readyState} (${d.readyStateText}) | Seeking: ${d.seeking} | Paused: ${d.paused}`);
        lines.push(`      CurrentTime: ${d.currentTime}s | Rate: ${d.playbackRate} | NetState: ${d.networkStateText}`);
        if (d.videoWidth > 0) lines.push(`      Video Dimensions: ${d.videoWidth}x${d.videoHeight}`);
        if (d.bufferedRanges && d.bufferedRanges.length > 0) {
          lines.push(`      Buffered: ${d.bufferedRanges.map((r: any) => `[${r.start}-${r.end}]`).join(', ')}`);
        }
        if (d.error) lines.push(`      ERROR: ${d.error}`);
      }
    } else {
      lines.push('  Decoder pool is currently empty.');
    }

    lines.push('', '--- 5. RECENT FLIGHT RECORDER TRAIL ---');
    const events = inc ? inc.recentFlightEvents : this.flightEvents;
    for (const ev of events.slice(-15)) {
      lines.push(`  [${ev.timeStr}] [${ev.category.toUpperCase()}] ${ev.message}`);
    }

    lines.push(
      '',
      '================================================================================',
      'FULL RAW JSON SNAPSHOT',
      '================================================================================',
      JSON.stringify(
        {
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          incident: inc || null,
          allIncidentsCount: this.incidents.length,
          recentIncidents: this.incidents.slice(0, 5),
        },
        null,
        2
      )
    );

    return lines.join('\n');
  }

  /**
   * Downloads the complete diagnostic log as a timestamped .json file.
   */
  public downloadLog(incidentId?: string) {
    if (typeof window === 'undefined') return;
    const inc = incidentId ? this.incidents.find((i) => i.id === incidentId) : this.getLatestIncident();
    const reportText = this.generateReportString(inc);

    const blob = new Blob([reportText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `procut-playback-diagnostic-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /**
   * Copies the diagnostic report summary to clipboard.
   */
  public async copyToClipboard(incidentId?: string): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
    const inc = incidentId ? this.incidents.find((i) => i.id === incidentId) : this.getLatestIncident();
    const reportText = this.generateReportString(inc);
    try {
      await navigator.clipboard.writeText(reportText);
      return true;
    } catch {
      return false;
    }
  }
}

export const playbackDiagnostics = new PlaybackDiagnosticsService();

// Expose on global window object for immediate DevTools debugging
if (typeof window !== 'undefined') {
  (window as any).__procutDiagnostics = playbackDiagnostics;
  (window as any).downloadPlaybackLog = (incidentId?: string) => playbackDiagnostics.downloadLog(incidentId);
  (window as any).getPlaybackDiagnostics = () => playbackDiagnostics.getIncidents();
  (window as any).capturePlaybackSnapshot = (reason?: string) =>
    playbackDiagnostics.recordIncident('MANUAL_SNAPSHOT', reason || 'Captured manually from DevTools');
}
