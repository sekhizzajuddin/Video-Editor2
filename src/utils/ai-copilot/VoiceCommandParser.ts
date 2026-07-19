import { memoryStore, RecordedAction } from './MemoryStore';
import type { AIWorkflowReport } from '../../types';

/**
 * VoiceCommandParser — converts noisy voice transcripts into structured
 * commands and resolves references like "do that again", "the last one",
 * "that clip", "the same thing".
 *
 * Two-stage pipeline:
 *   1. Normalize (lowercase, strip fillers: "uh", "um", "like", "please")
 *   2. Resolve references against MemoryStore
 *
 * Phase 4 expansion of Phase 1 MemoryStore's basic reference resolver.
 */

const FILLER_WORDS = /\b(?:uh|um|like|please|just|kind of|kinda|sort of)\b[,\s]*/gi;
const ARTICLES = /^(\s*)(?:a|an|the)\s+/i;

const REFERENCE_PATTERNS: Array<{
  regex: RegExp;
  detect: (msg: string, last: RecordedAction | null) => boolean;
}> = [
  {
    regex: /\b(do )?(that|this|it)( again)?\??$/i,
    detect: (_msg) => true,
  },
  {
    regex: /\b(repeat (that|this|it))\b/i,
    detect: (_msg) => true,
  },
  {
    regex: /\b(same thing|same as before|again)\b/i,
    detect: (_msg) => true,
  },
  {
    regex: /\b(do the (last|previous) (one|thing|action|command))\b/i,
    detect: (_msg) => true,
  },
  {
    regex: /\b(run|try|redo) (the )?(last|previous|that) (one)?\b/i,
    detect: (_msg) => true,
  },
];

const PRONOUN_RESOLUTION_PATTERNS: Array<{
  regex: RegExp;
  buildPrompt: (last: RecordedAction) => string;
}> = [
  {
    regex: /\b(apply|do|run) (it|that|this) (too|also|again|to (the )?clip)\b/i,
    buildPrompt: (last) => `Apply ${last.toolName} with the same settings as before`,
  },
  {
    regex: /\b(do|apply) (the same|same) (to |on )?(it|that|this|the last one)\b/i,
    buildPrompt: (last) => `Apply ${last.toolName} (same args) to the most recent target`,
  },
  {
    regex: /\b(undo (that|it|this))\b/i,
    buildPrompt: () => `Undo the last action`,
  },
];

const TIME_PRONOUNS: Array<{ regex: RegExp; offsetDesc: (last: RecordedAction) => string }> = [
  {
    regex: /\b(again|another time|one more time)\b/i,
    offsetDesc: (last) =>
      `Original command was: "${last.rawPrompt}" (${last.toolName}, ${Date.now() - last.timestamp}ms ago)`,
  },
];

export interface VoiceParseResult {
  normalized: string;
  isReference: boolean;
  resolved?: string;
  originalPrompt?: string;
  lastAction?: RecordedAction | null;
  hint?: string;
}

export class VoiceCommandParser {
  /**
   * Normalize raw voice transcript.
   */
  static normalize(raw: string): string {
    let s = raw.trim();
    s = s.replace(FILLER_WORDS, '');
    // Strip orphan commas/punctuation left after filler removal
    s = s.replace(/(?:,\s*){2,}/g, ', ');
    s = s.replace(/^\s*,\s*/, '');
    s = s.replace(/,\s*$/, '');
    s = s.replace(ARTICLES, '$1');
    s = s.replace(/\s+/g, ' ');
    s = s.replace(/^\s+|!\s+|\?\s+/g, '');
    return s.trim();
  }

  /**
   * Convert transcript into executable command.
   *
   * @param transcript Raw text from STT (whisper, web-speech, etc.)
   * @returns VoiceParseResult — caller decides whether to escalate to AI or
   *                           use resolved text.
   */
  static parse(transcript: string): VoiceParseResult {
    const normalized = VoiceCommandParser.normalize(transcript);
    if (!normalized) {
      return { normalized: '', isReference: false };
    }

    const lastAction = memoryStore.getLastAction();

    // Direct reference patterns
    for (const pattern of REFERENCE_PATTERNS) {
      if (pattern.regex.test(normalized)) {
        if (!lastAction) {
          return {
            normalized,
            isReference: true,
            hint: 'No previous action to repeat yet.',
          };
        }

        // Look up time-based hint
        const timeHint =
          TIME_PRONOUNS.find((t) => t.regex.test(normalized))?.offsetDesc(lastAction) ?? '';

        const resolved = `Re-execute the previous action: ${lastAction.toolName} with args ${JSON.stringify(
          lastAction.args
        ).slice(0, 200)}. Original user command: "${lastAction.rawPrompt}". ${timeHint}`.trim();

        return {
          normalized,
          isReference: true,
          resolved,
          originalPrompt: lastAction.rawPrompt,
          lastAction,
        };
      }
    }

    // Pronoun expansion ("do it to that one")
    for (const pattern of PRONOUN_RESOLUTION_PATTERNS) {
      if (pattern.regex.test(normalized)) {
        if (!lastAction) {
          return {
            normalized,
            isReference: true,
            hint: 'No previous action to copy from.',
          };
        }
        const resolved = `${pattern.buildPrompt(lastAction)} | Original: "${lastAction.rawPrompt}"`;
        return {
          normalized,
          isReference: true,
          resolved,
          originalPrompt: lastAction.rawPrompt,
          lastAction,
        };
      }
    }

    return { normalized, isReference: false };
  }

  /**
   * Lightweight check used by callers that don't need full resolution.
   */
  static matchesReference(transcript: string): boolean {
    const normalized = VoiceCommandParser.normalize(transcript);
    if (!normalized) return false;
    return [
      ...REFERENCE_PATTERNS,
      ...PRONOUN_RESOLUTION_PATTERNS,
    ].some((p) => p.regex.test(normalized));
  }
}

export const voiceCommandParser = new VoiceCommandParser();

// ============================================================
// Workflow-specific memory utilities (Phase 4)
// ============================================================

/**
 * Persist the last N workflow reports for the "do that again with same args"
 * feature. Stores into MemoryStore via the SAME action history mechanism.
 */
export function rememberWorkflowReport(report: AIWorkflowReport): void {
  if (!report || report.steps.length === 0) return;

  // Each successful step becomes a RecordedAction so "do that again" works
  for (const step of report.steps) {
    if (step.status === 'success') {
      memoryStore.recordAction({
        toolName: step.toolName,
        args: step.args,
        rawPrompt: step.userFriendlyLabel ?? step.toolName,
        intent: `workflow:${report.planId}`,
        resultStatus: 'success',
        userFriendlyLabel: step.userFriendlyLabel,
      });
    }
  }
}
