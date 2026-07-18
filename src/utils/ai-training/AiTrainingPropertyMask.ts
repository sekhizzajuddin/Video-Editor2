import { AiTrainingModuleInterface, ConversationContext, IntentPattern, ToolValidationResult } from './types';

export class AiTrainingPropertyMask implements AiTrainingModuleInterface {
  getIntentPatterns(): IntentPattern[] {
    return [
      { 
        pattern: /(add mask|create mask|mask out|crop out)/i, 
        intent: 'ADD_MASK', 
        baseConfidence: 0.85, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['updateClip'] 
      },
      { 
        pattern: /(edit mask|feather|roundness|mask shape)/i, 
        intent: 'EDIT_MASK', 
        baseConfidence: 0.85, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['updateClip'] 
      },
      { 
        pattern: /(invert mask|reverse mask)/i, 
        intent: 'INVERT_MASK', 
        baseConfidence: 0.90, 
        requiredEntities: ['CLIP_REFERENCE'], 
        suggestedTools: ['updateClip'] 
      }
    ];
  }

  generateAnalysis(intent: string, context: ConversationContext): string | null {
    return 'User wants to modify the mask/alpha channel properties of a clip.';
  }

  generatePlan(intent: string, context: ConversationContext, availableTools: any[]): string | null {
    return '1. Parse mask parameters (type, x, y, feather, invert) → 2. Execute updateClip with mask settings → 3. Trigger re-composite';
  }

  generateReasoning(intent: string, analysis: string, plan: string, context: ConversationContext): string | null {
    return `\`${analysis} Strategy: ${plan}\` Masks: Use vector math for precise alpha clipping.`;
  }

  validateToolCall(toolName: string, args: any, context: ConversationContext): ToolValidationResult | null {
    return null;
  }
}
