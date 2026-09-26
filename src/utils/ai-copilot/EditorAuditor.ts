import { useEditorStore } from '../../store/editorStore';
import { aiToolRegistry } from '../aiToolRegistry';

export interface AuditIssue {
  id: string;
  category: 'BUG' | 'LOGIC_UPGRADE' | 'MISSING_FEATURE' | 'PERFORMANCE';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
}

export interface SystemAuditReport {
  timestamp: number;
  healthScore: number; // 0 - 100
  totalClips: number;
  totalTracks: number;
  toolRegistryCount: number;
  issues: AuditIssue[];
  missingFeaturesList: string[];
  summary: string;
}

// Industry Benchmark Features for modern video editors (Premiere, Resolve, CapCut)
const PROFESSIONAL_NLE_BENCHMARKS = [
  { id: 'beat_detection_snap', name: 'Audio Beat-Sync Snapping', desc: 'Automatically snap cuts and markers to musical beats in the soundtrack.' },
  { id: 'multitrack_ripple', name: 'Multi-Track Linked Ripple Editing', desc: 'Ripple-delete that shifts linked audio and video tracks symmetrically across the timeline.' },
  { id: 'optical_flow', name: 'Optical Flow & AI Speed Ramping', desc: 'Interpolated smooth slow-motion using motion vectors rather than frame duplicating.' },
  { id: 'color_match', name: 'Auto Shot-to-Shot Color Matching', desc: 'Match exposure and white balance between A-cam and B-cam clips.' },
  { id: 'voice_isolation', name: 'AI Voice Isolation & De-Noise', desc: 'Separate foreground speech from environmental noise using spectral subtraction.' },
  { id: 'compound_nesting', name: 'Nested Compound Sequences', desc: 'Collapse multiple tracks and clips into a single compound clip with re-entrant editing.' },
  { id: 'bezier_speed_curves', name: 'Visual Bezier Speed Curves', desc: 'Interactive curve editor for easing in/out clip playback speeds.' },
];

export class EditorAuditor {
  /**
   * Run a comprehensive system audit on both the active project state
   * and the software logic / feature coverage.
   */
  public static runAudit(): SystemAuditReport {
    const store = useEditorStore.getState();
    const issues: AuditIssue[] = [];

    const tracks = store.tracks || [];
    const mediaLibrary = store.mediaLibrary || [];
    const allClips = tracks.flatMap(t => t.clips || []);

    // ── 1. Timeline Logic & Bug Detection ─────────────────────────────────

    // A. Check for missing media references
    const mediaIdSet = new Set(mediaLibrary.map(m => m.id));
    for (const clip of allClips) {
      if (clip.mediaId && !mediaIdSet.has(clip.mediaId)) {
        issues.push({
          id: `missing-media-${clip.id}`,
          category: 'BUG',
          severity: 'high',
          title: `Orphaned Clip Media Reference (${clip.id})`,
          description: `Clip references mediaId "${clip.mediaId}" which does not exist in the mediaLibrary.`,
          recommendation: 'Verify media asset cleanup on deletion or auto-relink missing files.',
        });
      }
    }

    // B. Check for clip overlaps on the same track
    for (const track of tracks) {
      const sorted = [...(track.clips || [])].sort((a, b) => a.startTime - b.startTime);
      for (let i = 0; i < sorted.length - 1; i++) {
        const c1 = sorted[i];
        const c2 = sorted[i + 1];
        const c1End = c1.startTime + c1.duration;

        if (c1End > c2.startTime + 0.05) {
          issues.push({
            id: `overlap-${c1.id}-${c2.id}`,
            category: 'BUG',
            severity: 'critical',
            title: `Clip Overlap Conflict on Track ${track.id}`,
            description: `Clip "${c1.id}" overlaps into "${c2.id}" by ${(c1End - c2.startTime).toFixed(2)}s. This causes frame flicker and rendering race conditions.`,
            recommendation: 'Enable magnetic track ripple or resolve clip start times during placement.',
          });
        }
      }
    }

    // C. Check keyframe boundary sanity
    for (const clip of allClips) {
      if (clip.animations) {
        const animProps = Object.values(clip.animations).filter(Boolean);
        for (const kfList of animProps) {
          for (const kf of kfList || []) {
            if (kf.time < clip.startTime || kf.time > clip.startTime + clip.duration + 0.1) {
              issues.push({
                id: `kf-out-of-bounds-${clip.id}`,
                category: 'LOGIC_UPGRADE',
                severity: 'medium',
                title: `Keyframe Out of Clip Bounds (${clip.id})`,
                description: `Keyframe at ${kf.time.toFixed(2)}s falls outside the clip duration (${clip.startTime.toFixed(2)}s - ${(clip.startTime + clip.duration).toFixed(2)}s).`,
                recommendation: 'Automatically clamp keyframe timestamps when trimming clip boundaries.',
              });
            }
          }
        }
      }
    }


    // ── 2. Feature Coverage & NLE Gap Analysis ─────────────────────────────

    const registeredToolNames = new Set(aiToolRegistry.map(t => t.name));
    const missingFeatures: string[] = [];

    for (const benchmark of PROFESSIONAL_NLE_BENCHMARKS) {
      // Check if tool registry or editor capabilities support this
      if (!registeredToolNames.has(benchmark.id)) {
        missingFeatures.push(benchmark.name);
        issues.push({
          id: `missing-${benchmark.id}`,
          category: 'MISSING_FEATURE',
          severity: 'medium',
          title: `Missing Feature: ${benchmark.name}`,
          description: benchmark.desc,
          recommendation: `Implement logic handler in editorStore and expose tool in aiToolRegistry.`,
        });
      }
    }

    // ── 3. Performance & Rendering Diagnostics ───────────────────────────

    if (allClips.length > 20) {
      issues.push({
        id: 'perf-high-clip-count',
        category: 'PERFORMANCE',
        severity: 'low',
        title: 'High Timeline Density (>20 Clips)',
        description: 'Large clip counts can introduce scrub latency if thumbnail strip rendering is un-virtualized.',
        recommendation: 'Ensure timeline viewport windowing (react-window or bounding-box culling) is enabled for clip strips.',
      });
    }

    // Calculate overall health score
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const highCount = issues.filter(i => i.severity === 'high').length;
    const mediumCount = issues.filter(i => i.severity === 'medium').length;

    let score = 100 - (criticalCount * 25) - (highCount * 10) - (mediumCount * 3);
    score = Math.max(10, Math.min(100, score));

    const summary = `System Audit Complete: Health Score ${score}/100. Detected ${issues.length} items (${criticalCount} critical, ${highCount} high, ${mediumCount} medium). ${missingFeatures.length} professional NLE features identified for upgrade.`;

    return {
      timestamp: Date.now(),
      healthScore: score,
      totalClips: allClips.length,
      totalTracks: tracks.length,
      toolRegistryCount: aiToolRegistry.length,
      issues,
      missingFeaturesList: missingFeatures,
      summary,
    };
  }
}
