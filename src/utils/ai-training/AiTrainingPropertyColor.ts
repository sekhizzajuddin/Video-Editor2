import { AiTrainingModuleInterface, ConversationContext, IntentPattern, ToolValidationResult } from './types';

export class AiTrainingPropertyColor implements AiTrainingModuleInterface {
  getIntentPatterns(): IntentPattern[] {
    return [
      { 
        pattern: /(color|grade|filter|effect|look|style)/i, 
        intent: 'APPLY_COLOR_EFFECT', 
        baseConfidence: 0.75, 
        requiredEntities: ['CLIP_REFERENCE', 'COLOR_VALUE'], 
        suggestedTools: ['updateClip'] 
      },
      { 
        pattern: /(brighten|exposure|lighten|darken)/i, 
        intent: 'ADJUST_EXPOSURE', 
        baseConfidence: 0.75, 
        requiredEntities: ['CLIP_REFERENCE', 'COLOR_VALUE'], 
        suggestedTools: ['updateClip'] 
      },
      { 
        pattern: /(contrast|sharpen|soften)/i, 
        intent: 'ADJUST_CONTRAST', 
        baseConfidence: 0.75, 
        requiredEntities: ['CLIP_REFERENCE', 'COLOR_VALUE'], 
        suggestedTools: ['updateClip'] 
      },
      { 
        pattern: /(saturate|desaturate|vibrance)/i, 
        intent: 'ADJUST_SATURATION', 
        baseConfidence: 0.75, 
        requiredEntities: ['CLIP_REFERENCE', 'COLOR_VALUE'], 
        suggestedTools: ['updateClip'] 
      },
      { 
        pattern: /(blur|sharpen|focus)/i, 
        intent: 'APPLY_BLUR', 
        baseConfidence: 0.75, 
        requiredEntities: ['CLIP_REFERENCE', 'COLOR_VALUE'], 
        suggestedTools: ['updateClip'] 
      },
      { 
        pattern: /(warm|cool|temperature|white balance)/i, 
        intent: 'ADJUST_TEMPERATURE', 
        baseConfidence: 0.75, 
        requiredEntities: ['CLIP_REFERENCE', 'COLOR_VALUE'], 
        suggestedTools: ['updateClip'] 
      },
    ];
  }

  generateAnalysis(intent: string, context: ConversationContext): string | null {
    if (['APPLY_COLOR_EFFECT', 'ADJUST_EXPOSURE', 'ADJUST_CONTRAST', 'ADJUST_SATURATION', 'APPLY_BLUR', 'ADJUST_TEMPERATURE'].includes(intent)) {
      return `User wants to enhance visual appearance. Will apply color grading parameters to clip(s).`;
    }
    return null;
  }

  generatePlan(intent: string, context: ConversationContext, availableTools: any[]): string | null {
    if (['APPLY_COLOR_EFFECT', 'ADJUST_EXPOSURE', 'ADJUST_CONTRAST', 'ADJUST_SATURATION', 'APPLY_BLUR', 'ADJUST_TEMPERATURE'].includes(intent)) {
      return '1. Parse color parameters → 2. Map to colorFilters schema → 3. Execute updateClip with color values → 4. Update scopes/analyzer if visible';
    }
    return null;
  }

  generateReasoning(intent: string, analysis: string, plan: string, context: ConversationContext): string | null {
    if (['APPLY_COLOR_EFFECT', 'ADJUST_EXPOSURE', 'ADJUST_CONTRAST', 'ADJUST_SATURATION', 'APPLY_BLUR', 'ADJUST_TEMPERATURE'].includes(intent)) {
      return `\`${analysis} Strategy: ${plan}\` Quality: Apply in linear color space for accuracy.`;
    }
    return null;
  }

  validateToolCall(toolName: string, args: any, context: ConversationContext): ToolValidationResult | null {
    // This module only validates color-related properties in updateClip.
    // The AiTrainingPropertyTransformation handles basic validation.
    return null;
  }
}
