import { useEditorStore } from '../../store/editorStore';
import {
  ALL_TESTS,
  TEST_REGISTRY_BY_CATEGORY,
  CATEGORY_LABELS,
  TestDefinition,
  TestCategory,
} from './testDefinitions';
import type { AISelfTestReport, AISelfTestResult } from '../../types';

export interface AutoTesterOptions {
  /**
   * Limit to one or more categories. Defaults to "all".
   */
  scope?: TestCategory | 'full';
  /** Skip tests with skip=true (default false) */
  includeSkips?: boolean;
  /** Per-test timeout in ms (default 15000) */
  perTestTimeoutMs?: number;
  /** Skip tests that the project can't support (e.g., no media file) */
  skipEmptyProject?: boolean;
}

export interface RunningAutoTester {
  abort(): void;
  currentCategory: TestCategory | null;
  completedResults: AISelfTestResult[];
  totalToRun: number;
}

/**
 * AutoTester — Phase 3 autonomous test runner.
 *
 * "Start app testing from import to edit to export and provide detailed report"
 *
 * Runs ~50 tests across 8 categories, each invoking REAL tools against the
 * user's current project. Tests that mutate state are wrapped in
 * snapshot/restore via the editor store.
 *
 * Result: AISelfTestReport with pass/fail, categories, and human-readable
 * "Working / Not Working" summary.
 */
export class AutoTester {
  private aborted = false;
  private currentRunId = 0; // BUG #5: track runs to prevent overlap
  private snapshot: any = null;
  private listeners = {
    onProgress: new Set<(progress: { done: number; total: number; current: string }) => void>(),
    onResult: new Set<(result: AISelfTestResult) => void>(),
    onCategoryChange: new Set<(category: TestCategory) => void>(),
  };

  abort(): void {
    this.aborted = true;
  }

  /**
   * Returns the current active run id (0 if no run is active).
   * Used by callers to bail out early when a newer run starts.
   */
  getActiveRunId(): number {
    return this.currentRunId;
  }

  subscribe(opts: {
    onProgress?: (progress: { done: number; total: number; current: string }) => void;
    onResult?: (result: AISelfTestResult) => void;
    onCategoryChange?: (category: TestCategory) => void;
  }): () => void {
    const cleanups: Array<() => void> = [];
    if (opts.onProgress) {
      this.listeners.onProgress.add(opts.onProgress);
      cleanups.push(() => this.listeners.onProgress.delete(opts.onProgress!));
    }
    if (opts.onResult) {
      this.listeners.onResult.add(opts.onResult);
      cleanups.push(() => this.listeners.onResult.delete(opts.onResult!));
    }
    if (opts.onCategoryChange) {
      this.listeners.onCategoryChange.add(opts.onCategoryChange);
      cleanups.push(() => this.listeners.onCategoryChange.delete(opts.onCategoryChange!));
    }
    return () => cleanups.forEach((c) => c());
  }

  async runReport(options: AutoTesterOptions = {}): Promise<AISelfTestReport> {
    this.aborted = false;
    this.currentRunId += 1; // BUG #5: stamp each run
    const runId = this.currentRunId;
    this.snapshot = this.captureSnapshot();
    const startedAt = Date.now();

    const scope = options.scope ?? 'full';
    const perTestTimeoutMs = options.perTestTimeoutMs ?? 15000;
    const tests: TestDefinition[] = this.selectTests(scope);
    const results: AISelfTestResult[] = [];

    const total = tests.length;
    let done = 0;
    let currentCat: TestCategory | null = null;

    for (const test of tests) {
      if (this.aborted) break;
      if (runId !== this.currentRunId) break; // BUG #5: a newer run superseded us

      // Notify category change
      if (test.category !== currentCat) {
        currentCat = test.category;
        this.listeners.onCategoryChange.forEach((cb) => cb(test.category));
      }

      this.listeners.onProgress.forEach((cb) => cb({ done, total, current: test.testName }));

      const result = await this.runOne(test, perTestTimeoutMs);
      if (runId !== this.currentRunId) break; // BUG #5: bail mid-test if superseded

      results.push(result);
      this.listeners.onResult.forEach((cb) => cb(result));

      done++;
    }

    // Final progress emission
    this.listeners.onProgress.forEach((cb) => cb({ done, total, current: '' }));

    const report = this.buildReport(results, total, Date.now() - startedAt);
    if (runId === this.currentRunId) {
      // Only restore if WE are still the current run
      this.restoreSnapshot();
    }
    return report;
  }

  /**
   * Build a report aggregating results.
   */
  private buildReport(
    results: AISelfTestResult[],
    total: number,
    durationMs: number
  ): AISelfTestReport {
    const passed = results.filter((r) => r.status === 'pass').length;
    const failed = results.filter((r) => r.status === 'fail').length;
    const skipped = results.filter((r) => r.status === 'skip').length;
    const passRate = total > 0 ? (passed / total) * 100 : 0;

    const byCategory: Record<string, { passed: number; failed: number; total: number }> = {};
    for (const r of results) {
      if (!byCategory[r.category]) {
        byCategory[r.category] = { passed: 0, failed: 0, total: 0 };
      }
      byCategory[r.category].total++;
      if (r.status === 'pass') byCategory[r.category].passed++;
      else if (r.status === 'fail') byCategory[r.category].failed++;
    }

    const workingFeatures: string[] = [];
    const notWorkingFeatures: string[] = [];
    for (const r of results) {
      if (r.status === 'pass') {
        workingFeatures.push(r.testName);
      } else if (r.status === 'fail') {
        notWorkingFeatures.push(`${r.testName}${r.error ? ` — ${r.error}` : ''}`);
      }
    }

    let summary = '';
    if (failed === 0) {
      summary = `🎉 All ${total} tests passed! (${(durationMs / 1000).toFixed(1)}s)`;
    } else if (passed > failed) {
      summary = `⚠️ Mostly working: ${passed}✅ / ${failed}❌ (${skipped} skipped) — ${passRate.toFixed(0)}% pass rate`;
    } else {
      summary = `❌ Major issues: ${passed}✅ / ${failed}❌ — ${passRate.toFixed(0)}% pass rate`;
    }

    return {
      totalTests: total,
      passed,
      failed,
      skipped,
      passRate,
      durationMs,
      byCategory,
      results,
      workingFeatures,
      notWorkingFeatures,
      summary,
    };
  }

  /**
   * Run a single test with timeout.
   */
  private async runOne(test: TestDefinition, timeoutMs: number): Promise<AISelfTestResult> {
    const start = Date.now();
    let timeoutHandle: any = null;

    try {
      const store = useEditorStore.getState();
      const ctx = {
        store,
        countClips: () => store.tracks.reduce((s: number, t: any) => s + (t?.clips?.length ?? 0), 0),
        snapshotBefore: () => this.captureSnapshot(),
        restoreSnapshot: (snap: any) => this.applySnapshot(snap),
      };

      const result = await Promise.race([
        Promise.resolve(test.runner(ctx)),
        new Promise<{ ok: boolean; message: string; details?: string }>((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error(`Test timed out after ${timeoutMs}ms`)),
            timeoutMs
          );
        }),
      ]);
      if (timeoutHandle) clearTimeout(timeoutHandle);

      const status = result?.ok === true ? 'pass' : 'fail';
      return {
        testId: test.testId,
        testName: test.testName,
        category: test.category,
        status,
        durationMs: Date.now() - start,
        message: result?.message ?? (status === 'pass' ? 'OK' : 'Failed'),
        details: result?.details,
        error: status === 'fail' ? result?.message : undefined,
      };
    } catch (err: any) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      return {
        testId: test.testId,
        testName: test.testName,
        category: test.category,
        status: 'fail',
        durationMs: Date.now() - start,
        message: 'Test runner error',
        error: err?.message ?? String(err),
      };
    }
  }

  /**
   * Pick tests by scope.
   *   "full" → ALL_TESTS
   *   any other value → that category
   */
  private selectTests(scope: TestCategory | 'full'): TestDefinition[] {
    if (scope === 'full') return ALL_TESTS;
    return TEST_REGISTRY_BY_CATEGORY[scope] ?? [];
  }

  /**
   * Capture key editor state for restore after potentially-mutating tests.
   */
  private captureSnapshot(): any {
    try {
      const store = useEditorStore.getState();
      return {
        tracks: JSON.parse(JSON.stringify(store.tracks ?? [])),
        mediaLibrary: JSON.parse(JSON.stringify(store.mediaLibrary ?? [])),
        folders: JSON.parse(JSON.stringify(store.folders ?? [])),
        selectedClipIds: JSON.parse(JSON.stringify(store.selectedClipIds ?? [])),
        totalDuration: store.totalDuration,
        ts: Date.now(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Restore the snapshot via setState. Useful for tests that mutate state.
   */
  private restoreSnapshot(): void {
    if (!this.snapshot) return;
    this.applySnapshot(this.snapshot);
  }

  private applySnapshot(snap: any): void {
    if (!snap) return;
    try {
      // Snapshot restoration MUST preserve undo history — do NOT call
      // saveSnapshot which would push the test state onto the user's undo stack.
      // We also do NOT mutate keyed history fields. setState replaces refs;
      // zustand won't trigger snapshots unless those actions are called.
      useEditorStore.setState((current: any) => ({
        tracks: snap.tracks,
        mediaLibrary: snap.mediaLibrary,
        folders: snap.folders ?? current.folders ?? [],
        selectedClipIds: snap.selectedClipIds ?? current.selectedClipIds ?? [],
        totalDuration: snap.totalDuration,
      }));
    } catch (err) {
      console.warn('[AutoTester] Snapshot restore failed:', err);
    }
  }
}

export const autoTester = new AutoTester();

export { CATEGORY_LABELS };
