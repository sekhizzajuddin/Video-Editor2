import { AiTrainingModuleInterface, ConversationContext, IntentPattern, ToolValidationResult } from './types';

export class AiTrainingPropertyTransformation implements AiTrainingModuleInterface {
  getIntentPatterns(): IntentPattern[] {
    return [
      { 
        pattern: /(animate|keyframe|motion|transform|animate)/i, 
        intent: 'ADD_KEYFRAME', 
        baseConfidence: 0.80, 
        requiredEntities: ['CLIP_REFERENCE', 'KEYFRAME_TYPE', 'TIME'], 
        suggestedTools: ['addMasterKeyframe'] 
      },
      { 
        pattern: /(zoom|scale).*in/i, 
        intent: 'ZOOM_IN', 
        baseConfidence: 0.75, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['addMasterKeyframe', 'updateClip'] 
      },
      { 
        pattern: /(zoom|scale).*out/i, 
        intent: 'ZOOM_OUT', 
        baseConfidence: 0.75, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['addMasterKeyframe', 'updateClip'] 
      },
      { 
        pattern: /(rotate|spin|turn)/i, 
        intent: 'ROTATE_CLIP', 
        baseConfidence: 0.75, 
        requiredEntities: ['CLIP_REFERENCE', 'TRANSFORM_VALUE'], 
        suggestedTools: ['addMasterKeyframe', 'updateClip'] 
      },
      { 
        pattern: /(fade|in|out|opacity|transparent)/i, 
        intent: 'FADE_CLIP', 
        baseConfidence: 0.75, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['addMasterKeyframe', 'updateClip'] 
      },
      { 
        pattern: /(trim|crop|shorten|lengthen|extend).*clip/i, 
        intent: 'TRIM_CLIP', 
        baseConfidence: 0.80, 
        requiredEntities: ['CLIP_REFERENCE', 'DURATION'], 
        suggestedTools: ['updateClip'] 
      },
    ];
  }

  generateAnalysis(intent: string, context: ConversationContext): string | null {
    if (intent === 'ADD_KEYFRAME' || intent === 'ZOOM_IN' || intent === 'ZOOM_OUT' || intent === 'ROTATE_CLIP' || intent === 'FADE_CLIP') {
      return `User wants to create animation or transform properties. Will need to determine interpolation type, easing, and property values.`;
    }
    if (intent === 'TRIM_CLIP') {
      return `User wants to adjust clip boundaries. Need to validate trim points don't exceed media duration.`;
    }
    return null;
  }

  generatePlan(intent: string, context: ConversationContext, availableTools: any[]): string | null {
    if (intent === 'ADD_KEYFRAME' || intent === 'ZOOM_IN' || intent === 'ZOOM_OUT' || intent === 'ROTATE_CLIP' || intent === 'FADE_CLIP') {
      return '1. Identify target clip → 2. Parse property values (transform, opacity, etc) → 3. Validate property paths exist → 4. Execute addMasterKeyframe or updateClip → 5. Show keyframe editor if needed';
    }
    if (intent === 'TRIM_CLIP') {
      return '1. Validate trim points (trimStart < trimEnd) → 2. Ensure within media duration → 3. Execute updateClip with trim values → 4. Recalculate clip duration';
    }
    return null;
  }

  generateReasoning(intent: string, analysis: string, plan: string, context: ConversationContext): string | null {
    if (intent === 'ADD_KEYFRAME' || intent === 'ZOOM_IN' || intent === 'ZOOM_OUT' || intent === 'ROTATE_CLIP' || intent === 'FADE_CLIP') {
      return `\`${analysis} Strategy: ${plan}\` Animation: Use bezier interpolation for smooth motion.`;
    }
    if (intent === 'TRIM_CLIP') {
      return `\`${analysis} Strategy: ${plan}\` Boundary: Respect media source duration limits.`;
    }
    return null;
  }

  validateToolCall(toolName: string, args: any, context: ConversationContext): ToolValidationResult | null {
    if (toolName === 'addMasterKeyframe') {
      if (!args.clipId) return { valid: false, error: 'clipId is required' };
      if (args.time === undefined) return { valid: false, error: 'time is required' };
      if (!args.values || typeof args.values !== 'object') return { valid: false, error: 'values object is required' };
      return { valid: true };
    }
    if (toolName === 'updateClip') {
      if (!args.clipId) return { valid: false, error: 'clipId is required' };
      if (!args.updates || typeof args.updates !== 'object') return { valid: false, error: 'updates object is required' };
      return { valid: true };
    }
    return null;
  }
}
