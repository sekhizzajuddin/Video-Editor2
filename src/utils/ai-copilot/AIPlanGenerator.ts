import type { AIWorkflowPlan, AIToolStep } from '../../types';
import type { ConversationContext } from '../ai-training/types';
import {
  buildVocabularyHint,
  buildVocabularySnapshot,
  getDomainVocabularyList,
  normalizeVocabulary,
} from './VocabularyCorrections';
import {
  pickPlan,
  buildSystemHint,
} from './SemanticsDisambiguator';
import { groqChat } from './groqChat';
import { getCatalogOrFallback } from './groqModelCatalog';

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

const SYSTEM_PROMPT = `You are an expert video-editing automation planner.

NEVER invent tools, actions, or argument keys that don't exist in the registry.

Given a user request, the current project state, and the available tools, you MUST return a single JSON object (no prose, no markdown fences) with this exact shape:

{
  "intent": "Short intent label (e.g. APPLY_MASK, CHANGE_OPACITY)",
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
1. Use ONLY tools from the AVAILABLE TOOLS list, EVERY toolName MUST be exact match.
   ✘ DO NOT call: "settings", "settings Mask", "re-composite Masks", "Mask action", "Apply LUT Settings"
   ✔ USE ONLY: updateClip, splitClip, rippleDeleteClip, addMasterKeyframe, addText, addTransition, seek, etc.
2. Order steps so each step's prerequisites are met by earlier steps.
3. If a step might fail, list a fallback approach in "alternatives".
4. Keep steps MINIMAL (prefer 1-3 steps, max 5 unless user requested a workflow).
5. Args MUST match the tool's JSON schema (no extra fields, required fields present).
6. Confidence below 0.7 means ask for clarification — return { "clarify": true, "question": "..." } instead of steps.
7. For destructive operations (delete/remove/export/overwrite/splitClip/autoCuts), include their index in destructiveOpsIndices.
8. Never invent mediaIds, clipIds, or trackIds — use placeholders like "{{last_clip}}" or rely on implicit selection.
9. ALL text values should be JSON-safe strings (no raw newlines, escape quotes).
10. Return ONLY the JSON object. No leading/trailing text.

DOMAIN ACCURACY:
- "mask / alpha" → updateClip with key "mask" (NOT a separate tool). Shape: { x, y, width, height, rotation, feather, roundness }.
- "color / LUT / look" → updateClip with key "colorFilters". Shape: { temperature, tint, exposure, contrast, saturation, blur, fadedFilm, vignette }.
- "transform / zoom / pan / rotate" → updateClip with key "transform". Shape: { x, y, scale, rotation, flipH, flipV }.
- "audio / volume / mute" → updateClip with key "audioSettings". Shape: { volume, pan, fadeIn, fadeOut, bass, mid, treble, muted }.
- "text" → addText tool.
- "transition / fade" → addTransition tool.
- "animate / expression / formula / math / jiggle / shake" → applyAnimationExpression tool. Args: { clipId, property, expression }. Example expressions: "wiggle(2, 50)" for shake, "Math.sin(time)*100" for wave.

SPELLING / VOCABULARY:
- The user's request goes through vocabulary correction. If you see "modifl" it's already "modify". Trust the normalized form.

CLARIFICATION:
- If the user requests something ambiguous (e.g., "make it better"), say clarify: true and ask for a specific outcome.
- If a property has no explicit value, ask before assuming a default.
`;

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
      temperature: config.temperature ?? 0.1, // Phase 5: lower temp for precision
      maxOutputTokens: config.maxOutputTokens ?? 1800,
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
    try {
      const catalog = getCatalogOrFallback();
      const result = await groqChat({
        purpose: 'reasoning',
        model: ctx.model ?? catalog.reasoning ?? DEFAULT_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: this.config.temperature,
        maxTokens: this.config.maxOutputTokens,
        json: true,
        timeoutMs: 25000,
      });
      return this.parseJsonPlan(result.content ?? '', ctx);
    } catch (err: any) {
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

    // Phase 5: Apply vocabulary corrections BEFORE the prompt goes to the
    // model. The user often types things like "modifl" or "alhpa"; we
    // normalize them so the model sees clean input. We then attach a
    // vocabulary hint so the model understands what we did.
    const vocabSnap = buildVocabularySnapshot(ctx.userMessage);
    const normalizedUserMessage = normalizeVocabulary(ctx.userMessage) || ctx.userMessage;
    const vocabHint = buildVocabularyHint(ctx.userMessage);

    // Phase 5: Disambiguate to a single high-confidence intent + canonical
    // tool, lock down the arg shape, and forbid hallucinated tool names.
    const plan = pickPlan(normalizedUserMessage);
    const semanticHint = buildSystemHint(plan.plan ?? { intent: 'unknown', canonicalTool: '', properties: [], confidence: 0, summary: '' }) || '';

    // Phase 5: Domain vocabulary so model uses canonical words.
    const domainVocab = getDomainVocabularyList();

    return `USER REQUEST (verbatim): "${ctx.userMessage}"

USER REQUEST (normalized): "${normalizedUserMessage}"

${vocabHint ? vocabHint + '\n' : ''}${semanticHint ? semanticHint + '\n' : ''}
CURRENT PROJECT CONTEXT:
${JSON.stringify(ctx.conversation, null, 2)}

DOMAIN VOCABULARY (canonical names you MUST use):
${domainVocab}

AVAILABLE TOOLS (only use these EXACT names — never invent tools):
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
    const cleanedContent = this.stripJsonFence(content);
    try {
      parsed = JSON.parse(cleanedContent);
    } catch (err) {
      // Try one more time with an aggressive extractor: locate first '{' and
      // matching '}' (allowing nested braces).
      const innerJson = this.extractFirstJsonObject(cleanedContent);
      if (innerJson) {
        try {
          parsed = JSON.parse(innerJson);
        } catch {
          return this.fallbackPlan(ctx, 'JSON parse failed after re-extract');
        }
      } else {
        return this.fallbackPlan(ctx, 'JSON parse failed');
      }
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

  /**
   * Strip JSON code fences some Groq/Llama models wrap their output in:
   *   ```json
   *   { ... }
   *   ```
   * also removes stray prose around the JSON.
   */
  private stripJsonFence(content: string): string {
    if (!content) return '';
    let out = content.trim();

    // Strip ```json ... ``` or ``` ... ``` fences.
    const fenceMatch = out.match(/^```(?:json|JSON)?\s*([\s\S]*?)```\s*$/);
    if (fenceMatch) {
      out = fenceMatch[1].trim();
    }

    // Remove a leading leading prose paragraph before the first '{'.
    const openIdx = out.indexOf('{');
    const closeIdx = out.lastIndexOf('}');
    if (openIdx !== -1 && closeIdx !== -1 && closeIdx > openIdx) {
      out = out.substring(openIdx, closeIdx + 1);
    }
    return out.trim();
  }

  /**
   * Best-effort extractor for the first balanced JSON object in `content`.
   * Avoids the case where the model emits multiple JSON blocks.
   */
  private extractFirstJsonObject(content: string): string | null {
    if (!content) return null;
    const start = content.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < content.length; i++) {
      const ch = content[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return content.substring(start, i + 1);
      }
    }
    return null;
  }
}

export const aiPlanGenerator = new AIPlanGenerator();
