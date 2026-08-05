import type { AIWorkflowPlan, AIToolStep, AIWorkflowReport } from '../../types';
import type { ConversationContext } from '../ai-training/types';
import { useEditorStore } from '../../store/editorStore';
import {
  executeAITool,
  requiresConfirmation,
} from '../aiToolRegistry';
import { globalRateLimiter } from './RateLimiter';
import { aiPlanGenerator } from './AIPlanGenerator';
import { subAgentRouter, type SubAgent } from './SubAgents';

export interface ExecutorConfig {
  maxIterations?: number;
  maxExecutionMs?: number;
  allowReplan?: boolean;
  requestConfirmation: (step: AIToolStep) => Promise<boolean>;
  onStepUpdate?: (step: AIToolStep, index: number) => void;
  onPhaseChange?: (phase: ExecutionPhase) => void;
  apiKey?: string;
  model?: string;
}

export type ExecutionPhase =
  | 'idle'
  | 'planning'
  | 'precondition'
  | 'executing'
  | 'observing'
  | 'reflecting'
  | 'replanning'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ExecutionContext {
  conversation: ConversationContext;
  toolRegistry: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }>;
}

interface NormalizedConfig {
  maxIterations: number;
  maxExecutionMs: number;
  allowReplan: boolean;
  requestConfirmation: (step: AIToolStep) => Promise<boolean>;
  onStepUpdate?: (step: AIToolStep, index: number) => void;
  onPhaseChange?: (phase: ExecutionPhase) => void;
  apiKey?: string;
  model?: string;
}

export class WorkflowExecutor {
  private config: NormalizedConfig;
  private aborted = false;
  private startedAt = 0;

  constructor(config: ExecutorConfig) {
    this.config = {
      ...config,
      maxIterations: config.maxIterations ?? 2, // bounded re-plan budget
      maxExecutionMs: config.maxExecutionMs ?? 120000, // 2 min cap
      allowReplan: config.allowReplan ?? true,
    };
  }

  abort(): void {
    this.aborted = true;
  }

  /**
   * Main entry: parse the prompt (or use a pre-built plan), execute steps
   * locally with SubAgent validation, auto-roll forward, and produce a report.
   *
   * RPM cost: 1 (for plan generation) + 0..maxIterations re-plans.
   */
  async run(
    prompt: string,
    ctx: ExecutionContext,
    options: {
      skipReplan?: boolean;
      existingPlan?: AIWorkflowPlan;
    } = {}
  ): Promise<AIWorkflowReport> {
    this.aborted = false;
    this.startedAt = Date.now();
    this.config.onPhaseChange?.('planning');

    let plan: AIWorkflowPlan;
    if (options.existingPlan) {
      plan = options.existingPlan;
    } else {
      plan = await aiPlanGenerator.generatePlan({
        userMessage: prompt,
        conversation: ctx.conversation,
        availableTools: ctx.toolRegistry,
        apiKey: this.config.apiKey,
        model: this.config.model,
      });
    }

    return this.executePlan(plan, ctx, options.skipReplan ?? false);
  }

  /**
   * Execute a plan step-by-step. Re-plans only on critical failure.
   */
  async executePlan(
    initialPlan: AIWorkflowPlan,
    ctx: ExecutionContext,
    skipReplan: boolean
  ): Promise<AIWorkflowReport> {
    let plan = initialPlan;
    let iteration = 0;
    let lastError: string | null = null;
    let lastFailedStep: AIToolStep | null = null;

    while (iteration <= this.config.maxIterations) {
      if (this.aborted) {
        return this.buildReport(plan, [], 'cancelled', lastError);
      }
      if (Date.now() - this.startedAt > this.config.maxExecutionMs) {
        return this.buildReport(plan, [], 'failed', 'Execution timed out (2 min cap)');
      }

      this.config.onPhaseChange?.('executing');

      // Execute steps with optional confirmation gate.
      // We add a tiny `requestAnimationFrame` yield between steps so React
      // commits prior state updates before the next tool mutates the store.
      // This prevents React error #310 storms when a single workflow
      // contains many state-mutating steps (e.g. "import all media" = ~20
      // addClip calls back-to-back).
      const results: AIToolStep[] = [];
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        if (this.aborted) break;

        // Local precondition check (0 RPM)
        const pre = subAgentRouter.precondition(step, ctx.conversation);
        if (!pre.canProceed) {
          const failed = this.markStepFailed(step, pre.reason ?? 'precondition failed');
          results.push(failed);
          this.config.onStepUpdate?.(failed, i);
          lastError = pre.reason ?? null;
          lastFailedStep = failed;
          // Replan-able: store failed step
          break;
        }

        const result = await this.executeStep(step);
        results.push(result);
        this.config.onStepUpdate?.(result, i);

        // Yield to the browser so React can flush commits before the next
        // mutation. Skipping the yield may produce 50+ pending setState
        // calls in <16ms and trigger React error #310.
        if (i < plan.steps.length - 1) {
          await new Promise<void>((resolve) =>
            typeof requestAnimationFrame !== 'undefined'
              ? requestAnimationFrame(() => resolve())
              : setTimeout(resolve, 16)
          );
        }

        if (result.status === 'failed' && result.requiresConfirmation === false) {
          lastError = result.error ?? null;
          lastFailedStep = result;
          break;
        }
      }

      if (this.aborted) {
        return this.buildReport(plan, results, 'cancelled', lastError);
      }

      // If all succeeded → done
      const allSucceeded = results.every((r) => r.status === 'success');
      if (allSucceeded || results.length === 0) {
        return this.buildReport(plan, results, 'completed');
      }

      // If failure and re-plan disabled → fail
      if (skipReplan || !this.config.allowReplan) {
        return this.buildReport(plan, results, 'failed', lastError);
      }

      // Re-plan budget check
      iteration += 1;
      if (iteration > this.config.maxIterations) {
        return this.buildReport(
          plan,
          results,
          'failed',
          `Re-planned ${this.config.maxIterations}x without success. Last error: ${lastError}`
        );
      }

      // Re-plan only on critical failure
      this.config.onPhaseChange?.('replanning');

      const fallbackSteps = lastFailedStep
        ? subAgentRouter.fallbackFor(lastFailedStep, lastError ?? 'unknown')
        : null;

      if (fallbackSteps && fallbackSteps.length > 0) {
        plan = {
          ...plan,
          steps: fallbackSteps,
          totalSteps: fallbackSteps.length,
        };
        continue;
      }

      // Ask the AI for a revised plan (1 more RPM)
      const revision = await this.requestRevision(
        plan,
        results,
        ctx,
        lastError ?? 'unknown'
      );
      plan = revision;
    }

    return this.buildReport(plan, [], 'failed', lastError);
  }

  /**
   * Execute a single step with optional confirmation + sub-agent preflight.
   */
  private async executeStep(step: AIToolStep): Promise<AIToolStep> {
    const startedAt = Date.now();
    step.status = 'running';
    step.startedAt = startedAt;

    try {
      // ASK_CLARIFICATION is a virtual step (returns immediately)
      if (step.toolName === 'ASK_CLARIFICATION') {
        return {
          ...step,
          status: 'awaiting_confirmation',
          completedAt: Date.now(),
          result: { question: step.args?.question },
        };
      }

      // Confirmation gate (Phase 1 logic)
      if (step.requiresConfirmation || requiresConfirmation(step.toolName, step.args)) {
        const approved = await this.config.requestConfirmation(step);
        if (!approved) {
          return {
            ...step,
            status: 'failed',
            completedAt: Date.now(),
            error: 'User cancelled',
          };
        }
      }

      // Sub-agent validation
      const validationResult = subAgentRouter.validateStep(
        step,
        useEditorStore.getState() as any
      );
      if (!validationResult.valid) {
        return {
          ...step,
          status: 'failed',
          completedAt: Date.now(),
          error: validationResult.error,
        };
      }
      const finalArgs = validationResult.sanitizedArgs ?? step.args;

      const result = executeAITool(step.toolName, finalArgs);

      return {
        ...step,
        args: finalArgs,
        status: result.success ? 'success' : 'failed',
        result,
        error: result.error,
        completedAt: Date.now(),
      };
    } catch (err: any) {
      return {
        ...step,
        status: 'failed',
        completedAt: Date.now(),
        error: err?.message ?? 'unknown error',
      };
    }
  }

  /**
   * Request a plan revision from the AI on critical failure.
   * Counts as 1 additional RPM (bounded by maxIterations).
   */
  private async requestRevision(
    previousPlan: AIWorkflowPlan,
    results: AIToolStep[],
    ctx: ExecutionContext,
    error: string
  ): Promise<AIWorkflowPlan> {
    const failedSteps = results.filter((r) => r.status === 'failed');
    const revisionContext = {
      ...ctx.conversation,
      lastFailure: error,
      failedStepSummary: failedSteps.map((s) => ({
        tool: s.toolName,
        args: s.args,
        error: s.error,
      })),
    };

    return await aiPlanGenerator.generatePlan({
      userMessage: `Fix this: ${previousPlan.prompt}. Previous attempt failed: ${error}`,
      conversation: revisionContext,
      availableTools: ctx.toolRegistry,
      apiKey: this.config.apiKey,
      model: this.config.model,
    });
  }

  private markStepFailed(step: AIToolStep, reason: string): AIToolStep {
    return {
      ...step,
      status: 'failed',
      error: reason,
      completedAt: Date.now(),
    };
  }

  private buildReport(
    plan: AIWorkflowPlan,
    steps: AIToolStep[],
    phase: ExecutionPhase,
    error?: string | null
  ): AIWorkflowReport {
    const successCount = steps.filter((s) => s.status === 'success').length;
    const failedCount = steps.filter((s) => s.status === 'failed').length;
    const skippedCount = steps.filter(
      (s) => s.status === 'awaiting_confirmation'
    ).length;

    return {
      planId: plan.id,
      totalSteps: plan.totalSteps ?? plan.steps.length,
      successCount,
      failedCount,
      skippedCount,
      totalDurationMs: Date.now() - this.startedAt,
      summary: this.buildSummary(phase, successCount, failedCount, plan.totalSteps ?? plan.steps.length, error),
      steps,
    };
  }

  private buildSummary(
    phase: ExecutionPhase,
    success: number,
    failed: number,
    total: number,
    error?: string | null
  ): string {
    if (phase === 'completed') {
      return `✅ Workflow complete: ${success}/${total} steps succeeded.`;
    }
    if (phase === 'cancelled') {
      return `⏹️ Workflow cancelled by user. ${success} succeeded, ${failed} failed.`;
    }
    if (phase === 'failed') {
      return `❌ Workflow failed: ${success}/${total} succeeded. ${error ?? ''}`;
    }
    return `Workflow in phase: ${phase}`;
  }
}

/**
 * Convenience factory: build an executor bound to confirmation + update hooks
 * without needing to wire them manually per-call site.
 */
export function createExecutor(deps: {
  apiKey?: string;
  requestConfirmation: (step: AIToolStep) => Promise<boolean>;
  onStepUpdate?: (step: AIToolStep, index: number) => void;
  onPhaseChange?: (phase: ExecutionPhase) => void;
  model?: string;
  maxIterations?: number;
  allowReplan?: boolean;
  maxExecutionMs?: number;
}): WorkflowExecutor {
  return new WorkflowExecutor({
    apiKey: deps.apiKey,
    model: deps.model,
    allowReplan: deps.allowReplan ?? true,
    requestConfirmation: deps.requestConfirmation,
    onStepUpdate: deps.onStepUpdate,
    onPhaseChange: deps.onPhaseChange,
    maxIterations: deps.maxIterations ?? 2,
    maxExecutionMs: deps.maxExecutionMs ?? 120000,
  });
}
