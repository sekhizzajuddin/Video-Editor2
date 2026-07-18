import type { AIWorkflowPlan, AIToolStep } from '../../types';
import type { ConversationContext } from '../ai-training/types';

/**
 * Sub-Agents provide local, expert logic for specific editing domains.
 * They handle routine decisions WITHOUT calling the AI (saving RPM).
 * They run LATERALLY to AIPlanGenerator / WorkflowExecutor for validation.
 */

export interface SubAgentCapability {
  toolName: string;
  domains: string[];
  description: string;
}

export interface SubAgentValidationResult {
  valid: boolean;
  sanitizedArgs?: Record<string, any>;
  error?: string;
  warning?: string;
  suggestAlternate?: boolean;
}

export interface SubAgent {
  name: string;
  domain: string;
  tools: string[];
  capability: SubAgentCapability;
  /**
   * Sanitize and validate args BEFORE execution.
   * (Local decision — no AI call.)
   */
  validateAndFill(args: any, context: ConversationContext): SubAgentValidationResult;
  /**
   * Pre-flight check: are preconditions met? (e.g. media exists for import)
   */
  preconditionCheck(args: any, context: ConversationContext): {
    canProceed: boolean;
    reason?: string;
  };
  /**
   * Optional: produce a smart fallback plan when this agent's tool fails.
   */
  fallback?(originalStep: AIToolStep, error: string): AIToolStep[] | null;
}

// ============================================================
// Media Sub-Agent
// ============================================================
export class MediaSubAgent implements SubAgent {
  name = 'Media Operations';
  domain = 'media';
  tools = ['addClip', 'addText', 'getEditorState'];

  capability: SubAgentCapability = {
    toolName: '*',
    domains: ['media', 'import', 'organize'],
    description: 'Handles clip creation, text overlays, and timeline organization.',
  };

  preconditionCheck(args: any, context: ConversationContext) {
    if (this.tools.includes('addClip') && args?.mediaId) {
      const mediaExists = context.mediaLibrary?.some?.((m: any) => m?.id === args.mediaId);
      if (!mediaExists) {
        return {
          canProceed: false,
          reason: `Media with id "${args.mediaId}" not found in library`,
        };
      }
    }
    return { canProceed: true };
  }

  validateAndFill(args: any, context: ConversationContext): SubAgentValidationResult {
    if (!args || typeof args !== 'object') {
      return { valid: false, error: 'Args must be an object' };
    }
    const sanitized = { ...args };

    if (typeof sanitized.startTime === 'number') {
      const totalDur = context.projectContext?.totalDuration ?? 0;
      if (sanitized.startTime < 0) {
        sanitized.startTime = 0;
        return {
          valid: true,
          sanitizedArgs: sanitized,
          warning: 'Negative startTime clamped to 0',
        };
      }
      if (sanitized.startTime > totalDur + 600) {
        return {
          valid: false,
          error: `startTime ${sanitized.startTime}s exceeds safe range (project is ${totalDur.toFixed(1)}s)`,
          suggestAlternate: true,
        };
      }
    }

    if (typeof sanitized.duration === 'number' && sanitized.duration <= 0) {
      sanitized.duration = Math.max(0.5, sanitized.duration);
      return {
        valid: true,
        sanitizedArgs: sanitized,
        warning: 'Non-positive duration clamped to 0.5s minimum',
      };
    }

    return { valid: true, sanitizedArgs: sanitized };
  }

  fallback(step: AIToolStep, error: string): AIToolStep[] | null {
    if (step.toolName !== 'addClip') return null;
    return [
      {
        id: `${step.id}_fallback`,
        toolName: 'getEditorState',
        args: {},
        expectation: 'Retrieve current project state to find fallback options',
        rollbackable: true,
        requiresConfirmation: false,
        status: 'pending',
        userFriendlyLabel: 'Recovery: gather project state',
      },
    ];
  }
}

// ============================================================
// Edit Sub-Agent
// ============================================================
export class EditSubAgent implements SubAgent {
  name = 'Timeline Editing';
  domain = 'edit';
  tools = [
    'splitClip',
    'rippleDeleteClip',
    'updateClip',
    'addMasterKeyframe',
    'moveClip',
    'trimClip',
  ];

  capability: SubAgentCapability = {
    toolName: '*',
    domains: ['edit', 'trim', 'split', 'delete'],
    description: 'Handles timeline edits: split, delete, trim, keyframes.',
  };

  preconditionCheck(args: any, context: ConversationContext) {
    if (args?.clipId) {
      const exists = context.selectedClipIds.includes(args.clipId)
        || (context as any).allClipIds?.includes?.(args.clipId);
      if (!exists && !(context as any).allowUnknownIds) {
        return {
          canProceed: false,
          reason: `Clip "${args.clipId}" not found and not selected`,
        };
      }
    }
    return { canProceed: true };
  }

  validateAndFill(args: any, _context: ConversationContext): SubAgentValidationResult {
    if (!args || typeof args !== 'object') {
      return { valid: false, error: 'Args must be an object' };
    }
    const sanitized = { ...args };

    if (sanitized.splitTime !== undefined) {
      if (typeof sanitized.splitTime !== 'number' || isNaN(sanitized.splitTime)) {
        return { valid: false, error: 'splitTime must be a valid number' };
      }
      if (sanitized.splitTime < 0) {
        sanitized.splitTime = 0;
      }
    }

    if (sanitized.startTime !== undefined) {
      if (typeof sanitized.startTime !== 'number' || isNaN(sanitized.startTime)) {
        return { valid: false, error: 'startTime must be a valid number' };
      }
    }

    if (sanitized.updates !== undefined && typeof sanitized.updates === 'object') {
      // Pass through; downstream store handles schema
    }

    return { valid: true, sanitizedArgs: sanitized };
  }

  fallback(step: AIToolStep, error: string): AIToolStep[] | null {
    if (error.includes('not found')) {
      return [
        {
          id: `${step.id}_fallback`,
          toolName: 'getEditorState',
          args: {},
          expectation: 'Retrieve actual clip/track IDs',
          rollbackable: true,
          requiresConfirmation: false,
          status: 'pending',
          userFriendlyLabel: 'Recovery: gather state',
        },
      ];
    }
    return null;
  }
}

// ============================================================
// Audio Sub-Agent (Phase 2: stub — Phase 3 enrichment)
// ============================================================
export class AudioSubAgent implements SubAgent {
  name = 'Audio Operations';
  domain = 'audio';
  tools = ['updateClip']; // audio is handled via updateClip with audioSettings

  capability: SubAgentCapability = {
    toolName: '*',
    domains: ['audio', 'volume', 'music'],
    description: 'Handles volume, pan, fade, EQ via updateClip.',
  };

  preconditionCheck(args: any, context: ConversationContext) {
    if (this.tools.includes('updateClip') && args?.clipId) {
      const exists = context.selectedClipIds.includes(args.clipId);
      if (!exists) {
        return { canProceed: true, reason: 'No selected clip — AI may autofill' };
      }
    }
    return { canProceed: true };
  }

  validateAndFill(args: any, _ctx: ConversationContext): SubAgentValidationResult {
    if (!args || typeof args !== 'object') {
      return { valid: false, error: 'Args must be an object' };
    }
    return { valid: true, sanitizedArgs: { ...args } };
  }
}

// ============================================================
// Color Sub-Agent
// ============================================================
export class ColorSubAgent implements SubAgent {
  name = 'Color & Effects';
  domain = 'color';
  tools = ['updateClip', 'addMasterKeyframe'];

  capability: SubAgentCapability = {
    toolName: '*',
    domains: ['color', 'filter', 'effect'],
    description: 'Color grading, filters, LUTs via updateClip + keyframes.',
  };

  preconditionCheck(args: any, context: ConversationContext) {
    if (args?.clipId && !context.selectedClipIds.includes(args.clipId)) {
      return { canProceed: true, reason: 'No specific clip selected — applies broadly' };
    }
    return { canProceed: true };
  }

  validateAndFill(args: any, _ctx: ConversationContext): SubAgentValidationResult {
    if (!args || typeof args !== 'object') {
      return { valid: false, error: 'Args must be an object' };
    }

    if (args.updates && typeof args.updates === 'object') {
      const colorFilters = args.updates.colorFilters;
      if (colorFilters && typeof colorFilters === 'object') {
        // Clamp values to expected ranges
        if (typeof colorFilters.exposure === 'number') {
          colorFilters.exposure = Math.max(-100, Math.min(100, colorFilters.exposure));
        }
        if (typeof colorFilters.contrast === 'number') {
          colorFilters.contrast = Math.max(0, Math.min(200, colorFilters.contrast));
        }
        if (typeof colorFilters.saturation === 'number') {
          colorFilters.saturation = Math.max(0, Math.min(200, colorFilters.saturation));
        }
        if (typeof colorFilters.temperature === 'number') {
          colorFilters.temperature = Math.max(-100, Math.min(100, colorFilters.temperature));
        }
      }
    }

    return { valid: true, sanitizedArgs: { ...args } };
  }
}

// ============================================================
// Playback Sub-Agent
// ============================================================
export class PlaybackSubAgent implements SubAgent {
  name = 'Playback Control';
  domain = 'playback';
  tools = ['play', 'pause', 'seek'];

  capability: SubAgentCapability = {
    toolName: '*',
    domains: ['playback', 'navigation'],
    description: 'Play, pause, and seek operations — handled locally.',
  };

  preconditionCheck(_args: any, _context: ConversationContext) {
    return { canProceed: true };
  }

  validateAndFill(args: any, _ctx: ConversationContext): SubAgentValidationResult {
    if (!args || typeof args !== 'object') {
      return { valid: true, sanitizedArgs: {} };
    }
    const sanitized = { ...args };
    if (typeof sanitized.time === 'number') {
      if (sanitized.time < 0) sanitized.time = 0;
      if (sanitized.time > 86400) sanitized.time = 86400; // cap at 24h
    }
    return { valid: true, sanitizedArgs: sanitized };
  }
}

// ============================================================
// Meta / Test Sub-Agent (for self-test)
// ============================================================
export class MetaSubAgent implements SubAgent {
  name = 'Diagnostics';
  domain = 'meta';
  tools = ['getEditorState', 'runSelfTest'];

  capability: SubAgentCapability = {
    toolName: '*',
    domains: ['diagnostic', 'test', 'state'],
    description: 'Introspection and self-testing.',
  };

  preconditionCheck(_args: any, _ctx: ConversationContext) {
    return { canProceed: true };
  }

  validateAndFill(args: any, _ctx: ConversationContext): SubAgentValidationResult {
    return { valid: true, sanitizedArgs: args ?? {} };
  }
}

// ============================================================
// Sub-Agent Router
// ============================================================
const ALL_AGENTS: SubAgent[] = [
  new PlaybackSubAgent(),
  new EditSubAgent(),
  new MediaSubAgent(),
  new AudioSubAgent(),
  new ColorSubAgent(),
  new MetaSubAgent(),
];

export class SubAgentRouter {
  private agents: SubAgent[];

  constructor(agents: SubAgent[] = ALL_AGENTS) {
    this.agents = agents;
  }

  route(toolName: string): SubAgent | null {
    return this.agents.find((a) => a.tools.includes(toolName)) ?? null;
  }

  validateStep(
    step: AIToolStep,
    context: ConversationContext
  ): SubAgentValidationResult {
    const agent = this.route(step.toolName);
    if (!agent) {
      // Unknown tool — allow fallback to general handler
      return { valid: true, sanitizedArgs: step.args };
    }
    return agent.validateAndFill(step.args, context);
  }

  precondition(
    step: AIToolStep,
    context: ConversationContext
  ): { canProceed: boolean; reason?: string } {
    const agent = this.route(step.toolName);
    if (!agent) return { canProceed: true };
    return agent.preconditionCheck(step.args, context);
  }

  fallbackFor(step: AIToolStep, error: string): AIToolStep[] | null {
    const agent = this.route(step.toolName);
    if (!agent?.fallback) return null;
    return agent.fallback(step, error);
  }

  listCapabilities(): SubAgentCapability[] {
    return this.agents.map((a) => a.capability);
  }
}

export const subAgentRouter = new SubAgentRouter();
