import type { AIWorkflowPlan, AIToolStep } from '../../types';
import type { ConversationContext } from '../ai-training/types';

export interface PlanGenerationContext {
  userMessage: string;
  conversation: ConversationContext;
  availableTools: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }>;
  apiKey?: string;
  model?: string;
}

export interface PlanGenerationConfig {
  maxSteps?: number;
  temperature?: number;
  maxOutputTokens?: number;
}

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are an expert video-editing automation planner.

Given a user request, the current project state, and the available tools, you MUST return a single JSON object (no prose, no markdown fences) with this exact shape:

{
  "intent": "Short intent label (e.g. APPLY_CINEMATIC_LOOK)",
  "confidence": 0.0-1.0,
  "rationale": "1-2 sentence strategy explanation",
  "steps": [
    {
      "id": "step_1",
      "toolName": "tool_name_exactly_as_provided",
      "args": { ... },
      "expectation": "what should be true after this step",
      "rollbackable": true,
      "userFriendlyLabel": "human-readable description (e.g. 'Split clip at 5s')"
    }
  ],
  "alternatives": [
    "alternate-engineering-approach-if-step-fails"
  ],
  "destructiveOpsIndices": [0, 2]
}

Rules:
1. Use only tools from the AVAILABLE TOOLS list, EVERY toolName MUST be exact match.
2. Order steps so each step's prerequisites are met by earlier steps.
3. If a step might fail, list a fallback approach in "alternatives".
4. Keep steps MINIMAL (prefer 1-3 steps, max 5 unless user requested a workflow).
5. Args MUST match the tool's JSON schema (no extra fields, required fields present).
6. Confidence below 0.7 means ask for clarification — return { "clarify": true, "question": "..." } instead of steps.
7. For destructive operations (delete/remove/export/overwrite), include their index in destructiveOpsIndices.
8. Never invent mediaIds, clipIds, or trackIds — use placeholders like "{{last_clip}}" or rely on implicit selection.
9. ALL text values should be JSON-safe strings (no raw newlines, escape quotes).
10. Return ONLY the JSON object. No leading/trailing text.`;

/**
 * PlanGenerator - Single-call JSON plan generator.
 *
 * This module produces AIWorkflowPlan objects by calling Groq ONCE per workflow
 * (RPM friendly). It supports:
 *   - Bounded step execution (maxSteps)
 *   - Single-pass JSON output (no streaming)
 *   - Fallback plans when AI output is malformed
 */
export class AIPlanGenerator {
  private config: Required<PlanGenerationConfig>;

  constructor(config: PlanGenerationConfig = {}) {
    this.config = {
      maxSteps: config.maxSteps ?? 5,
      temperature: config.temperature ?? 0.3,
      maxOutputTokens: config.maxOutputTokens ?? 1500,
    };
  }

  /**
   * Generate a plan by calling Groq ONCE with a structured JSON prompt.
   * Uses tool registry descriptions to constrain AI to valid tool names.
   */
  async generatePlan(ctx: PlanGenerationContext): Promise<AIWorkflowPlan> {
    if (!ctx.apiKey) {
      return this.fallbackPlan(ctx, 'No API key configured');
    }

    const userPrompt = this.buildUserPrompt(ctx);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.apiKey}`,
        },
        body: JSON.stringify({
          model: ctx.model ?? DEFAULT_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxOutputTokens,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return this.fallbackPlan(ctx, `API ${response.status}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content ?? '';
      return this.parseJsonPlan(content, ctx);
    } catch (err: any) {
      clearTimeout(timeout);
      return this.fallbackPlan(ctx, err?.message ?? 'unknown');
    }
  }

  /**
   * Build the user-side message. Includes project context + available tools.
   */
  private buildUserPrompt(ctx: PlanGenerationContext): string {
    const toolList = ctx.availableTools
      .map(
        (t, i) =>
          `${i + 1}. ${t.name} — ${t.description}\n   Args: ${JSON.stringify(t.parameters)}`
      )
      .join('\n');

    return `USER REQUEST: "${ctx.userMessage}"

CURRENT PROJECT CONTEXT:
${JSON.stringify(ctx.conversation, null, 2)}

AVAILABLE TOOLS (only use these):
${toolList}

WORKFLOW: max ${this.config.maxSteps} steps. Limit destructive ops to necessary minimum.`;
  }

  /**
   * Attempt to parse Groq response into AIWorkflowPlan.
   * If parsing fails, build a fallback plan with a "clarify" message.
   */
  private parseJsonPlan(
    content: string,
    ctx: PlanGenerationContext
  ): AIWorkflowPlan {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = Date.now();

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      return this.fallbackPlan(ctx, 'JSON parse failed');
    }

    if (parsed?.clarify === true) {
      const question = parsed.question ?? 'Could you clarify your request?';
      const singleStep: AIToolStep = {
        id: 'clarify_step',
        toolName: 'ASK_CLARIFICATION',
        args: { question },
        expectation: 'User provides clarification',
        status: 'awaiting_confirmation',
        rollbackable: false,
        requiresConfirmation: false,
        userFriendlyLabel: question,
      };
      return {
        id: planId,
        prompt: ctx.userMessage,
        totalSteps: 1,
        steps: [singleStep],
        estimatedDuration: 5,
        needsConfirmation: false,
        destructiveOpsCount: 0,
        createdAt,
      };
    }

    const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];
    const destructiveSet = new Set<number>(
      Array.isArray(parsed.destructiveOpsIndices) ? parsed.destructiveOpsIndices : []
    );

    const validToolNames = new Set(ctx.availableTools.map((t) => t.name));
    const steps: AIToolStep[] = [];

    for (let i = 0; i < Math.min(rawSteps.length, this.config.maxSteps); i++) {
      const raw = rawSteps[i];
      if (!raw || typeof raw !== 'object') continue;

      const toolName = String(raw.toolName ?? '').trim();
      if (!validToolNames.has(toolName)) {
        // Skip invalid tool name — doesn't break the loop, just log
        console.warn(`[PlanGenerator] Unknown tool "${toolName}" skipped`);
        continue;
      }

      const args = (raw.args && typeof raw.args === 'object') ? raw.args : {};
      const stepId = raw.id ?? `step_${i + 1}`;
      const isDestructive = destructiveSet.has(i);

      const step: AIToolStep = {
        id: stepId,
        toolName,
        args,
        expectation: raw.expectation ?? undefined,
        rollbackable: typeof raw.rollbackable === 'boolean' ? raw.rollbackable : !isDestructive,
        requiresConfirmation: isDestructive,
        status: 'pending',
        userFriendlyLabel: raw.userFriendlyLabel ?? toolName,
      };
      steps.push(step);
    }

    if (steps.length === 0) {
      return this.fallbackPlan(ctx, 'No valid steps in AI response');
    }

    return {
      id: planId,
      prompt: ctx.userMessage,
      totalSteps: steps.length,
      steps,
      estimatedDuration: Math.max(10, steps.length * 5),
      needsConfirmation: steps.some((s) => s.requiresConfirmation),
      destructiveOpsCount: steps.filter((s) => s.requiresConfirmation).length,
      createdAt,
    };
  }

  /**
   * Build a safety fallback plan that just asks the user for clarification.
   */
  private fallbackPlan(ctx: PlanGenerationContext, reason: string): AIWorkflowPlan {
    const planId = `plan_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const step: AIToolStep = {
      id: 'fallback',
      toolName: 'ASK_CLARIFICATION',
      args: {
        question: `I couldn't construct a plan from that request (${reason}). Could you rephrase or be more specific?`,
      },
      expectation: 'User provides clarification',
      status: 'awaiting_confirmation',
      rollbackable: false,
      requiresConfirmation: false,
      userFriendlyLabel: 'Asking for clarification',
    };

    return {
      id: planId,
      prompt: ctx.userMessage,
      totalSteps: 1,
      steps: [step],
      estimatedDuration: 5,
      needsConfirmation: false,
      destructiveOpsCount: 0,
      createdAt: Date.now(),
    };
  }
}

export const aiPlanGenerator = new AIPlanGenerator();
