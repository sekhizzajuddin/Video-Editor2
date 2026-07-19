/**
 * AI Copilot feature flags.
 *
 * When `phasePreview` is true, new experimental features are enabled for
 * internal testing. Each flag can be set independently for fine-grained
 * control during phased rollout.
 *
 * Defaults: All OFF (production behavior). Set via process.env or window
 * global. E.g.:
 *    (window as any).__AICOPILOT_FLAGS__ = { workflowExecutor: true }
 *
 * Set to `true` in `.env`:
 *    VITE_AI_WORKFLOW_EXECUTOR=true
 *    VITE_AI_SELF_TEST=true
 *    VITE_AI_EXECUTION_STREAMING=true
 *    VITE_AI_VOICE_REFERENCES=true
 *    VITE_AI_PHASE_PREVIEW=true
 */

const env: any = (() => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env;
  }
  if (typeof process !== 'undefined' && (process as any).env) {
    return (process as any).env;
  }
  return {};
})();

const parseBool = (v: any): boolean => {
  if (v === true || v === 'true' || v === '1' || v === 1) return true;
  return false;
};

const globalFlags = (() => {
  if (typeof window !== 'undefined') {
    return (window as any).__AICOPILOT_FLAGS__ ?? {};
  }
  return {};
})();

export interface AiCopilotFlags {
  /** WorkflowExecutor (multi-step R&D) */
  workflowExecutor: boolean;
  /** AutoTester */
  selfTest: boolean;
  /** Token-streaming UX */
  executionStreaming: boolean;
  /** VoiceCommandParser reference resolver */
  voiceReferences: boolean;
  /** Destructive-op confirmation modal */
  destructiveConfirmation: boolean;
  /** Master toggle for all phase features */
  phasePreview: boolean;
}

const computeFlags = (): AiCopilotFlags => {
  const phasePreview =
    parseBool(globalFlags.phasePreview) ?? parseBool(env.VITE_AI_PHASE_PREVIEW) ?? false;

  return {
    workflowExecutor:
      parseBool(globalFlags.workflowExecutor) ??
      parseBool(env.VITE_AI_WORKFLOW_EXECUTOR) ??
      phasePreview,
    selfTest:
      parseBool(globalFlags.selfTest) ?? parseBool(env.VITE_AI_SELF_TEST) ?? phasePreview,
    executionStreaming:
      parseBool(globalFlags.executionStreaming) ??
      parseBool(env.VITE_AI_EXECUTION_STREAMING) ??
      phasePreview,
    voiceReferences:
      parseBool(globalFlags.voiceReferences) ??
      parseBool(env.VITE_AI_VOICE_REFERENCES) ??
      phasePreview,
    destructiveConfirmation:
      parseBool(globalFlags.destructiveConfirmation) ??
      parseBool(env.VITE_AI_DESTRUCTIVE_CONFIRMATION),
    phasePreview,
  };
};

let _flags: AiCopilotFlags = computeFlags();

export function getAiCopilotFlags(): Readonly<AiCopilotFlags> {
  if (!_flags) _flags = computeFlags();
  return _flags;
}

export function setAiCopilotFlags(overrides: Partial<AiCopilotFlags>): void {
  _flags = { ...getAiCopilotFlags(), ...overrides };
}

/** Test/dev helper: enable all preview features. */
export function enableAllPreviewFeatures(): void {
  setAiCopilotFlags({
    workflowExecutor: true,
    selfTest: true,
    executionStreaming: true,
    voiceReferences: true,
    destructiveConfirmation: true,
    phasePreview: true,
  });
}
