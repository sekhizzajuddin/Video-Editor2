import type { AIWorkflowReport, AIToolStep } from '../../types';

export type StreamEventType =
  | 'stream_start'
  | 'step_pending'
  | 'step_running'
  | 'step_success'
  | 'step_failed'
  | 'stream_progress'
  | 'stream_complete'
  | 'stream_error'
  | 'thinking_chunk';

export interface StreamEvent {
  type: StreamEventType;
  timestamp: number;
  data: Record<string, any>;
}

export interface StreamConfig {
  tokenCharRate?: number;
  progressSmoothing?: boolean;
  onEvent: (event: StreamEvent) => void;
}

/**
 * ExecutionStreamer — converts sync AIWorkflowReport progress into a smooth
 * UI stream of token-by-token text events.
 *
 * Used by Phase 4 to give the user a typewriter-feel workflow report without
 * waiting for the entire plan to finish.
 *
 * Example usage:
 *   const streamer = new ExecutionStreamer({ onEvent: e => ui.append(e) });
 *   executor.onStepUpdate((step, idx) => streamer.emitStep(step, idx));
 *   executor.run(prompt, ctx).then(report => streamer.emitComplete(report));
 */
export class ExecutionStreamer {
  private config: Required<StreamConfig>;
  private startTime = 0;
  private stepCount = 0;
  private typewriterTimers: any[] = [];

  constructor(config: StreamConfig) {
    this.config = {
      tokenCharRate: config.tokenCharRate ?? 35,
      progressSmoothing: config.progressSmoothing ?? true,
      onEvent: config.onEvent,
    };
  }

  start(totalSteps: number): void {
    this.startTime = Date.now();
    this.stepCount = totalSteps;
    this.config.onEvent({
      type: 'stream_start',
      timestamp: Date.now(),
      data: { totalSteps },
    });
  }

  emitStep(step: AIToolStep, index: number): void {
    let eventType: StreamEventType;
    if (step.status === 'running') eventType = 'step_running';
    else if (step.status === 'success') eventType = 'step_success';
    else if (step.status === 'failed') eventType = 'step_failed';
    else eventType = 'step_pending';

    this.config.onEvent({
      type: eventType,
      timestamp: Date.now(),
      data: { step, index },
    });

    // Simulate typing of the step label
    if (eventType === 'step_running' || eventType === 'step_success') {
      this.queueTypewriter(step.userFriendlyLabel ?? step.toolName, step);
    }
  }

  emitThinking(chunk: string): void {
    this.config.onEvent({
      type: 'thinking_chunk',
      timestamp: Date.now(),
      data: { chunk },
    });
  }

  emitProgress(done: number, total: number): void {
    this.config.onEvent({
      type: 'stream_progress',
      timestamp: Date.now(),
      data: { done, total, pct: total > 0 ? (done / total) * 100 : 0 },
    });
  }

  emitComplete(report: AIWorkflowReport): void {
    this.clearTimers();
    this.queueTypewriter(this.formatFinalReport(report), null, () => {
      this.config.onEvent({
        type: 'stream_complete',
        timestamp: Date.now(),
        data: { report },
      });
    });
  }

  emitError(error: string): void {
    this.clearTimers();
    this.config.onEvent({
      type: 'stream_error',
      timestamp: Date.now(),
      data: { error },
    });
  }

  abort(): void {
    this.clearTimers();
  }

  /**
   * Schedule typewriter effect for a string.
   * Calls onEvent('thinking_chunk') with growing prefix at tokenCharRate.
   * If the new event fires while a previous one is still pending, the
   * existing chained onEvent is replaced to avoid stale closure issues.
   */
  private queueTypewriter(
    text: string,
    step: AIToolStep | null,
    onDone?: () => void
  ): void {
    if (!text) {
      onDone?.();
      return;
    }
    const interval = Math.max(15, Math.floor(1000 / this.config.tokenCharRate));
    let pos = 0;
    let displayed = '';
    let cancelled = false;
    const handle = setInterval(() => {
      if (cancelled || pos >= text.length) {
        clearInterval(handle);
        if (!cancelled) onDone?.();
        return;
      }
      displayed += text[pos];
      pos++;
      this.config.onEvent({
        type: 'thinking_chunk',
        timestamp: Date.now(),
        data: { chunk: displayed, full: text, step },
      });
    }, interval);
    this.typewriterTimers.push(handle);
    // Note: cancellation flag is unused for now per-step, but tracked to allow
    // future aborts to short-circuit. We don't flip it here.
  }

  /** Throttle an onEvent consumer — coalesces rapid updates into one-per-frame. */
  static throttleConsumer<Args extends any[]>(
    fn: (...args: Args) => void,
    delayMs = 50
  ): (...args: Args) => void {
    let pending: Args | null = null;
    let timer: any = null;
    return (...args: Args) => {
      pending = args;
      if (timer) return;
      timer = setTimeout(() => {
        if (pending) fn(...pending);
        pending = null;
        timer = null;
      }, delayMs);
    };
  }

  private clearTimers(): void {
    this.typewriterTimers.forEach(clearInterval);
    this.typewriterTimers = [];
  }

  /**
   * Build the final markdown summary suitable for streaming into chat.
   */
  private formatFinalReport(report: AIWorkflowReport): string {
    const lines: string[] = [];
    lines.push('## ⚙️ Workflow Complete');
    lines.push('');
    lines.push(`**${report.summary}**`);
    lines.push('');

    if (report.steps.length > 0) {
      lines.push('### Steps');
      lines.push('');
      for (const s of report.steps) {
        const icon = s.status === 'success' ? '✅' : s.status === 'failed' ? '❌' : '⏸';
        lines.push(`${icon} ${s.userFriendlyLabel ?? s.toolName}${s.error ? ` — _${s.error}_` : ''}`);
      }
    }
    lines.push('');
    lines.push(`_Time: ${(report.totalDurationMs / 1000).toFixed(1)}s · ${report.successCount}/${report.totalSteps} succeeded_`);
    return lines.join('\n');
  }
}
